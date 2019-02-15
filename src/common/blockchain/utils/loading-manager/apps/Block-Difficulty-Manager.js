import MemoryManager from "./../Memory-Manager"

class BlockDifficultyManager extends MemoryManager{

    async _loadData(height){
        return this.blockchain.db.get("blockDiff"+height);
    }

    async getData(height) {

        if (this.savingManager._pendingBlocks[height])
            return (await this.savingManager._pendingBlocks[height]).difficultyTarget;

        if (this.loadingManager.blockManager._loaded[height])
            return (await this.loadingManager.getBlock(height)).difficultyTarget;

        return MemoryManager.prototype.getData.call(this, height);

    }

}

export default BlockDifficultyManager;