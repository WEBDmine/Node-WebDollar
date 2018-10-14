import consts from 'consts/const_global';
import BufferExtended from "common/utils/BufferExtended";

class BlockchainGenesis{

    constructor(){

        this.hashPrev = new Buffer("731D46C131EB6DD4667A96BDC27BAF9223BEC72C3468DFB6BA52C460E76423A4", "hex"); //main net

        this.timeStamp = 0;
        this.timeStampOffset = 1539513579; //main net
        //this.timeStampOffset = 1529344475; //test net

        this.difficultyTarget = new Buffer ( "00029112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb", "hex" ); //hard difficulty
        //this.difficultyTargetPOS = new Buffer ( "00000000000000000ac231b39a23dc4da786eff8147c4e72b9807785afee48bb", "hex" ); //hard difficulty
        this.difficultyTargetPOS = new Buffer ( "0000000000a44d81efd6a4b6a68718e792b2c6a3540806a038741c63f898e506", "hex" ); //hard difficulty

        this.address = BufferExtended.fromBase("WEBD$gBzsiV+$FARK8qSGqs09V6AEDBi#@fP6n7$"); // genesis address
    }

    validateGenesis(block){

        if ( block.timeStamp.length !== this.timeStamp.length )
            throw {message: "Timestamp doesn't match", timestamp: block.timeStamp};

        if ( block.timeStamp > 0x000FFFFF)
            throw {message: "Timestamp is too old ", timestamp: block.timeStamp};

        if (block.timeStamp < 0)
            throw {message: "Timestamp is invalid", timeStamp: block.timeStamp}
    }

    getLevel(){
        return 0;
    }

    isPoSActivated(height){

        if (height < consts.BLOCKCHAIN.HARD_FORKS.POS_ACTIVATION)
            return false;
        else {


            //0..19  pos
            //20..29 pow
            if ( height % 30 < 20) return true;
            else return false;

            //29,0..18  pos
            //19..28 pow

            // if ( (height+1) % 30 < 20) return true;
            // else return false;


        }


    }

}

export default new BlockchainGenesis();