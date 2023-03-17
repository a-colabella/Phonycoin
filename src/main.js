const { Blockchain, Transaction } = require('./blockchain');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const myKey = ec.keyFromPrivate('21d47f378fbed211433bc1c1ee9e83b946be786bfea0a518a6db3859072e75cf');
const myWalletAddress = myKey.getPublic('hex');

// Instantiate Blockchain
let phoneycoin = new Blockchain();

// Create a transaction
const tx1 = new Transaction(myWalletAddress, 'insert public key', 0);

// Sign transaction
tx1.signTransaction(myKey);

// Add transaction to pending transactions on Chain
phoneycoin.addTransaction(tx1);

// Mine pending transactions and create a new block
console.log('\n Starting the miner...');
phoneycoin.minePendingTransactions(myWalletAddress);

// Check miner's balance
console.log('\nBalance of my address is ', phoneycoin.getBalanceOfAddress(myWalletAddress));

// Check chain is valid
console.log('Is chain valid? ', phoneycoin.isChainValid());

// Print entire chain
console.log(JSON.stringify(phoneycoin));


