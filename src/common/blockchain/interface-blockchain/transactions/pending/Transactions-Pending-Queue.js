import consts from 'consts/const_global'
import BufferExtended from "common/utils/BufferExtended"
import TransactionsProtocol from "../protocol/Transactions-Protocol"
import TransactionsPendingQueueSavingManager from "./Transactions-Pending-Queue-Saving-Manager";
import Blockchain from "../../../../../main-blockchain/Blockchain";

class TransactionsPendingQueue {

    constructor(transactions, blockchain, db){

        this.transactionsProtocol = new TransactionsProtocol(blockchain);

        this.transactions = transactions;
        this.pendingQueueSavingManager = new TransactionsPendingQueueSavingManager(blockchain, this, db);

        this.blockchain = blockchain;
        this.list = {};
        this.listArray = [];

        this.db = db;

        setTimeout( this._removeOldTransactions.bind(this), 20000 );

    }

    includePendingTransaction (transaction, exceptSockets, avoidValidation = false){

        if ( this.findPendingTransaction(transaction.txId) !== null )
            return false;

        let blockValidationType = {
            "take-transactions-list-in-consideration": {
                validation: true
            }
        };

        if (!avoidValidation)
            if (!transaction.validateTransactionOnce(this.blockchain.blocks.length-1, blockValidationType ))
                return false;

        this._insertPendingTransaction(transaction,exceptSockets);

        return true;

    }

    _insertPendingTransaction(transaction,exceptSockets){

        let inserted = false;

        for (let i=0; i<this.listArray.length ; i++ ) {

            let compare = transaction.from.addresses[0].unencodedAddress.compare(this.listArray[i].from.addresses[0].unencodedAddress);

            if (compare < 0) // next
                continue;
            else
            if (compare === 0){ //order by nonce

                if (transaction.nonce === this.listArray[i].nonce){
                    inserted = true;
                    break;
                } else if (transaction.nonce < this.listArray[i].nonce){

                    let nonceGap = true;

                    if(this.listArray[i].nonce - transaction.nonce > 1) {
                        //Propagate missing nonce
                        for (let j = transaction.nonce + 1; j < this.listArray[i].nonce; j++) {
                            this.propagateMissingNonce(this.listArray[j].from.addresses[0].unencodedAddress, this.listArray[j].nonce);
                        }
                    }
                    else{
                        this.propagateTransaction(transaction, exceptSockets);
                        nonceGap = false;
                    }

                    this.listArray.splice(i, 0, transaction);
                    this.list[transaction.txId.toString('hex')] = transaction;
                    inserted = true;

                    //Propagate all tx after solving nonce gap
                    if (!nonceGap){
                        for( let j = i+1; j<this.listArray.length; j++){
                            let secondCompare = transaction.from.addresses[0].unencodedAddress.compare(this.listArray[j].from.addresses[0].unencodedAddress);
                            if(secondCompare === 0){
                                if(this.listArray[i].nonce - this.listArray[i-1].nonce === 1)
                                    this.propagateTransaction(transaction, exceptSockets);
                                else
                                    break;
                            }else{
                                break;
                            }
                        }
                    }

                    break;
                }

            }
            else
            if (compare > 0) { // i will add it
                this.propagateTransaction(transaction, exceptSockets);
                this.listArray.splice(i, 0, transaction);
                this.list[transaction.txId.toString('hex')] = transaction;
                inserted = true;
                break;
            }

        }

        if ( inserted === false){
            this.propagateTransaction(transaction, exceptSockets);
            this.listArray.push(transaction);
            this.list[transaction.txId.toString('hex')] = transaction;
        }

        console.warn("Transactions stack -", this.listArray.length);

        transaction.confirmed = false;
        transaction.pendingDateBlockHeight = this.blockchain.blocks.length-1;
        
        this.transactions.emitTransactionChangeEvent( transaction );

    }

    findPendingTransaction(txId){

        return this.list[txId.toString('hex')] ? this.list[txId.toString('hex')] : null;

    }

    findPendingTransactionByAddressAndNonce(address,searchedNonce){

        let selected = undefined, Left = 0, Right = this.listArray.length, compare = undefined;
        if(this.listArray.length){

            let selectedTwice = false;
            //Binary search for address
            while(Left <= Right)
            {

                selected = Math.floor((Left+Right) / 2);
                compare = this.listArray[selected].from.addresses[0].unencodedAddress.compare(address);

                if(selectedTwice!==selected) selectedTwice = selected;
                else {
                    console.warn("infinite loop missing nonce");
                    return false;
                }

                if(compare === 0)
                    break;
                if(compare > 0)
                    Left = selected--;
                if(compare < 0)
                    Right = selected++;
            }

            let closerSelected = undefined;
            if( this.listArray[selected].nonce > searchedNonce )
                closerSelected = this.listArray[selected].nonce + (this.listArray[selected].nonce-searchedNonce -1);
            else
                closerSelected = this.listArray[selected].nonce + (searchedNonce - this.listArray[selected].nonce -1);

            if ( this.listArray[closerSelected].from.addresses[0].unencodedAddress.compare(address) === 0);
                selected = closerSelected;

            let searchedNonceIsSmaller = this.listArray[selected].nonce > searchedNonce ? true : false;

            if( this.listArray[selected].nonce === searchedNonce )
                return this.listArray[selected].txId;

            let stop = false;

            for( let i = selected ; !stop ; searchedNonceIsSmaller ? i-- : i++){

                if(searchedNonceIsSmaller){
                    if(i<0) return false;
                }
                else if(!searchedNonceIsSmaller){
                    if(i>this.listArray.length) return false;
                }

                if( this.listArray[i].from.addresses[0].unencodedAddress.compare(address) === 0 ){
                    if( this.listArray[i].nonce === searchedNonce ){
                        return this.listArray[i].txId;
                    }else{
                        if( this.listArray[i].nonce > searchedNonce ){
                            if( searchedNonceIsSmaller ) continue;
                            else break;
                        }
                        else if( this.listArray[i].nonce < searchedNonce ){
                            if( searchedNonceIsSmaller ) continue;
                        }
                    }

                }else{
                    return false;
                }

            }

        }

        return false;

    }

    _removePendingTransaction (transaction, index){

        if (index === null)
            return true;

        this.list[transaction.txId.toString('hex')].destroyTransaction();

        delete this.list[transaction.txId.toString('hex')];

        this.listArray.splice(index, 1);

        this.transactions.emitTransactionChangeEvent(transaction, true);
    }

    _removeOldTransactions (){

        let blockValidationType = {
            "take-transactions-list-in-consideration": {
                validation: true
            }
        };

        for (let i=this.listArray.length-1; i >= 0; i--) {

            if (this.listArray[i].from.addresses[0].unencodedAddress.equals( this.blockchain.mining.unencodedMinerAddress )) continue;

            if ( this.blockchain.blocks.length - consts.BLOCKCHAIN.FORKS.IMMUTABILITY_LENGTH > this.listArray[i].timeLock && this.listArray[i].timeLock + consts.BLOCKCHAIN.FORKS.IMMUTABILITY_LENGTH < this.blockchain.blocks.length ){
                this._removePendingTransaction(this.listArray[i], i);
                continue;
            }

            try{

                if ( Blockchain.blockchain.agent.consensus )
                    this.listArray[i].validateTransactionEveryTime(undefined, blockValidationType );

            } catch (exception){

                if ( !exception.myNonce || Math.abs( exception.myNonce - exception.nonce) > consts.SPAM_GUARDIAN.MAXIMUM_DIFF_NONCE_ACCEPTED_FOR_QUEUE )
                    this._removePendingTransaction(this.listArray[i], i)

            }

        }

        setTimeout( this._removeOldTransactions.bind(this), 20000 );

    }

    propagateTransaction(transaction, exceptSocket){
        this.transactionsProtocol.propagateNewPendingTransaction(transaction, exceptSocket)
    }

    propagateMissingNonce(addressBuffer,nonce){
        this.transactionsProtocol.propagateNewMissingNonce(addressBuffer,nonce);
    }

}

export default TransactionsPendingQueue