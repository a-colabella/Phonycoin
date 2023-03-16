const { Blockchain, Transaction } = require('./blockchain');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const myKey = ec.keyFromPrivate('21d47f378fbed211433bc1c1ee9e83b946be786bfea0a518a6db3859072e75cf');
const myWalletAddress = myKey.getPublic('hex');

let phoneycoin = new Blockchain();

const tx1 = new Transaction(myWalletAddress, 'insert public key', 10);
tx1.signTransaction(myKey);
phoneycoin.addTransaction(tx1);

console.log('\n Starting the miner...');
phoneycoin.minePendingTransactions(myWalletAddress);

console.log('\nBalance of my address is ', phoneycoin.getBalanceOfAddress(myWalletAddress));

console.log('Is chain valid? ', phoneycoin.isChainValid());


