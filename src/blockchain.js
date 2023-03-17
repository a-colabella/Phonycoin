const SHA256 = require('crypto-js/sha256');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

/**
 * Defines a Transaction which consists of
 * fromAddress: the sender
 * toAddress: the receiver
 * amount: amount being transfered
 */
class Transaction {
    /**
     * 
     * @param {string} fromAddress 
     * @param {string} toAddress 
     * @param {number} amount 
     */
    constructor(fromAddress, toAddress, amount) {
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
    }

    /**
     * Creates SHA256 hash of transaction.
     * 
     * @returns {string}
     */
    calculateHash() {
        return SHA256(this.fromAddress + this.toAddress + this.amount).toString();
    }

    /**
     * Signs a transaction with the Elliptic keypair
     * that contains the user's private key.
     * Signature is stored inside the transaction object and stored
     * on chain.
     * @param {string} signingKey 
     */
    signTransaction(signingKey) {
        if (signingKey.getPublic('hex') !== this.fromAddress) {
            throw new Error('You cannot sign transactions for other wallets.');
        }

        const hashTx = this.calculateHash();
        const sig = signingKey.sign(hashTx, 'base64');
        this.signature = sig.toDER('hex');
    }

    /**
     * Checks if signature is valid. Uses fromAddress public key.
     * @returns {boolean}
     */
    isValid() {
        // We assume null fromAddress means it was a mining reward.
        if (this.fromAddress === null) return true;

        if (!this.signature || this.signature.length === 0) {
            throw new Error('No signature in this transaction');
        }

        const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
        return publicKey.verify(this.calculateHash(), this.signature);
    }
}

/**
 * Defines a single block on the blockchain.
 * A Block is comprised of
 * timestamp: when the block was created.
 * transactions: a list of transactions between parties
 * hash: a calculated identifier for the block
 * previousHash: a reference to the previous block in the chain
 */
class Block {
    /**
     * 
     * @param {Date} timestamp 
     * @param {Transaction[]} transactions 
     * @param {string} previousHash 
     */
    constructor(timestamp, transactions, previousHash = '') {
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
        this.nonce = 0;
    }

    /**
     * Returns the SHA256 hash of this block.
     * Calculated by processing all of the data in the block
     * with SHA256 algorithm and converting to a string.
     * @returns {string}
     */
    calculateHash() {
        return SHA256(this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce).toString();
    }

    /**
     * Mines a block by changing the 'nonce' value
     * until the hash of the block begins with
     * the same number of 0s equal to the difficulty number.
     * @param {number} difficulty 
     */
    mineBlock(difficulty) {
        while(this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
            this.nonce++;
            this.hash = this.calculateHash();
        }

        console.log("Block mined: " + this.hash);
    }

    /**
     * Validates all transactions in this block
     * checking signature and hash. Returns true
     * if all transactions are valid. Returns false
     * if a transaction is invalid.
     * @returns {boolean}
     */
    hasValidTransactions() {
        for(const tx of this.transactions) {
            if(!tx.isValid()) {
                return false;
            }
        }

        return true;
    }
}

/**
 * Defines the blockchain which consists of
 * chain: an array of Blocks
 * difficulty: the difficulty level to mine a new block
 * pendingTransactions: an array of Transactions that have yet to be mined.
 * miningReward: the amount of tokens rewarded to user that mines a block.
 */
class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 3 ;
        this.pendingTransactions = [];
        this.miningReward = 50;
    }

    /**
     * The first block must be hardcoded onto the chain
     * to initialize the chain. References March 15, 2023
     * as the date when the chain was first initialized.
     * @returns {Block}
     */
    createGenesisBlock() {
        return new Block(Date.parse("2023-03-15"), "NYT: Bank Fears Go Global, Sending Shudder Through Markets", "0");
    }

    /**
     * Returns the latest block on the chain.
     * Used for creating a new block and finding the hash
     * of the previous block.
     * @returns {Block}
     */
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    /**
     * Puts all pending transactions into a new
     * Block and begins mining. This Block will
     * also include a transaction for sending the mining
     * reward to the given address.
     * @param {string} miningRewardAddress 
     */
    minePendingTransactions(miningRewardAddress) {
        const rewardTx = new Transaction(null, miningRewardAddress, this.miningReward);
        this.pendingTransactions.push(rewardTx);

        let block = new Block(Date.now(), this.pendingTransactions, this.getLatestBlock().hash);
        block.mineBlock(this.difficulty);

        console.log("Block successfully mined.");
        this.chain.push(block);

        this.pendingTransactions = [];
    }

    /**
     * Adds a new transaction to the list of pending
     * transactions (to be added for the next mined block).
     * This function will verify that the transaction is signed and valid.
     * @param {Transaction} transaction 
     */
    addTransaction(transaction) {
        // Cannot send a transaction without a from and to address
        if (!transaction.fromAddress || !transaction.toAddress) {
            throw new Error('Transaction must include from and to address');
        }

        // Verify validity of transaction
        if (!transaction.isValid()) {
            throw new Error('Cannot add invalid transaction to chain');
        }

        // Ensure that amount sent is not greater than existing balance
        const walletBalance = this.getBalanceOfAddress(transaction.fromAddress);
        if (walletBalance < transaction.amount) {
            throw new Error('Not enough balance');
        }

        // Get all other pending transactions for the "from" wallet
        const pendingTxForWallet = this.pendingTransactions.filter(
            tx => tx.fromAddress === transaction.fromAddress
        );
  
        // If the wallet has more pending transactions, calculate the total amount
        // of spend coins so far. If this exceeds the balance, we refuse to add this
        // transaction.
        if (pendingTxForWallet.length > 0) {
            const totalPendingAmount = pendingTxForWallet
            .map(tx => tx.amount)
            .reduce((prev, curr) => prev + curr);
    
            const totalAmount = totalPendingAmount + transaction.amount;
            if (totalAmount > walletBalance) {
            throw new Error(
                'Pending transactions for this wallet is higher than its balance.'
            );
            }
        }

        this.pendingTransactions.push(transaction);
    }

    /**
     * Returns balance of a given wallet address.
     * 
     * @param {string} address 
     * @returns {number} balance of the wallet
     */
    getBalanceOfAddress(address) {
        let balance = 0;

        for (const block of this.chain) {
            for (const trans of block.transactions) {
                if(trans.fromAddress === address) {
                    balance -= trans.amount;
                }

                if(trans.toAddress === address) {
                    balance += trans.amount;
                }
            }
        }

        return balance;
    }

    /**
     * Iterates over all blocks in the chain.
     * Verifies if each block properly references the previous block
     * and the hashes have not been tampered. Verifies the signed
     * transactions within each block as well.
     * 
     * @returns {boolean}
     */
    isChainValid() {
        /**
         * Confirm Genesis block hasn't been tampered with.
         * Compare genesis of this chain with genesis from
         * createGenesisBlock function.
         */
        const realGenesis = JSON.stringify(this.createGenesisBlock());

        if(realGenesis !== JSON.stringify(this.chain[0])){
            return false;
        }
        
        // Check all remaining blocks and confirm hashes are correct.
        for(let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if(!currentBlock.hasValidTransactions()) {
                return false;
            }

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }

        return true;
    }
}

module.exports.Block = Block;
module.exports.Blockchain = Blockchain;
module.exports.Transaction = Transaction;