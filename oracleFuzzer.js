const Web3 = require('web3');
const fs = require('fs');

// Connect to your fork of the geth client
const web3 = new Web3("http://localhost:8545"); // Replace the URL with your geth client's RPC URL
// console.log(web3);
// console.log('reached');

var account1;
var account2;
var default_account
var contractAddress;
var contractInstance;

const addressToPassword = new Map();

function readFile(callback) {
    (async () => {
        fs.readFile('bytecode.txt', 'utf8', (error, data) => {
            if (error) {
                callback(error)
            } else {
                callback(null, data)
            }
        });
    })()
}

async function initialize() {
    // Set up your testing accounts (use pre-funded accounts from your geth client)
    // account1 = '0x83643Fd7cc5e3ED4Bae1298B1a96A4C29818DD5d';
    // account2 = '0xd1A78aFCDc6ed3Cc2acEDfEe8858DE84626305a1';

    var account1;
    var account2;
    const accounts = await web3.eth.getAccounts();
    default_account = accounts[0];
    console.log(default_account)
    balance = await web3.eth.getBalance(default_account);

    await web3.eth.personal.newAccount('password123').then((address) => {
        account1 = address
        addressToPassword.set(address, 'password123')
    }); // Prints the new account address

    await web3.eth.personal.newAccount('hello').then((address) => {
        account2 = address
        addressToPassword.set(address, 'hello')
    })

    await web3.eth.personal.unlockAccount(account1, 'password123', 86400);
    await web3.eth.personal.unlockAccount(account2, 'hello', 86400);

    // send ethereum
    const amountToSend = web3.utils.toWei('1', 'ether');
    await web3.eth.personal.unlockAccount(default_account, "", 86400);
    // await web3.eth.sendTransaction({ from: default_account, to: account1, value: amountToSend });
    // await web3.eth.sendTransaction({ from: default_account, to: account2, value: amountToSend });

    // Load the smart contract ABI and bytecode
    const abi = JSON.parse(fs.readFileSync('ABI_ERC20.json', 'utf8'));
    // bytecode

    const bytecode = fs.readFileSync('bytecode.txt', 'utf8');

    // bytcode = JSON.parse(data)
    usdcContract = await new web3.eth.Contract(abi);
    const options = {
        data: bytecode,
        gas: 5000000
    };

    const arguments = [web3.utils.toWei('10000', 'ether'), 'MyToken', 'MYT'];
    contractInstance = await usdcContract.deploy(options, arguments)
        .send({ from: default_account, gas: '5000000' })
        .on('transactionHash', async function (transactionHash) {
            const tx = await web3.eth.getTransaction(transactionHash, (error, transaction) => {
                if (error) {
                    console.error(error);
                } else {
                    const inputHex = transaction.input;
                    const unpaddedHex = inputHex.replace(/0+$/, '');
                    const inputBytes = web3.utils.hexToBytes(unpaddedHex);
                    // const firstNonZeroByteIndex = inputBytes.findIndex(b => b !== 0);
                    fs.appendFileSync('results.txt', inputBytes.length + '\n');
                }
            });
        })
        .on('receipt', function (receipt) {
            // console.log(receipt);
            // Call loop() function after the contract is deployed
        })
        .on('error', function (error) {
            console.error(error);
        })
        .catch(function (error) {
            console.error(error);
        });
    loop(account1, contractInstance); // Pass contractInstance to loop
    return [default_account, account1, contractInstance];
}

async function fuzzUsdc(accountFrom, accountTo, contractInstance) {
    const action = ['transfer', 'approve'][Math.floor(Math.random() * 2)];
    const value = web3.utils.toWei(Math.floor(Math.random() * 100).toString(), 'ether');

    const balance = await contractInstance.methods.balanceOf(accountFrom).call();
    const balanceEther = web3.utils.fromWei(balance, 'ether');
    console.log(balanceEther)
    // console.log(balance)

    // console.log(action)

    // console.log(accountFrom)
    // console.log(accountTo)

    if (action === 'transfer') {
        return new Promise((resolve, reject) => {
            contractInstance.methods.transfer(accountTo, value).send({ from: accountFrom })
                .on('transactionHash', (hash) => {
                    console.log('Transaction hash:', hash);
                    resolve(hash);
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    } else if (action === 'approve') {
        return new Promise((resolve, reject) => {
            contractInstance.methods.approve(accountTo, value).send({ from: accountFrom })
                .on('transactionHash', (hash) => {
                    console.log('Transaction hash:', hash);
                    resolve(hash);
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    } else if (action === 'transferFrom') {
        console.log(90)
        const allowance = await contractInstance.methods.allowance(accountFrom, accountTo).call();
        if (allowance > 0) {
            const transferValue = BigInt(value) > BigInt(allowance) ? allowance : value;
            return new Promise((resolve, reject) => {
                contractInstance.methods.transferFrom(accountFrom, accountTo, transferValue).send({ from: account1 })
                    .on('transactionHash', (hash) => {
                        resolve(hash);
                    })
                    .on('error', (error) => {
                        reject(error);
                    });
            });
        }
    }
}

async function loop(account1, contractInstance) {
    for (let i = 0; i < 1000; i++) {
        try {
            // fuzzUsdc now returns a promise that resolves to the transaction hash
            const txHash = await fuzzUsdc(default_account, account1, contractInstance);
            console.log(txHash);

            const tx = await web3.eth.getTransaction(txHash, (error, transaction) => {
                if (error) {
                    console.error(error);
                } else {
                    const inputHex = transaction.input;
                    const unpaddedHex = inputHex.replace(/0+$/, '');
                    const inputBytes = web3.utils.hexToBytes(unpaddedHex);
                    // const firstNonZeroByteIndex = inputBytes.findIndex(b => b !== 0);
                    fs.appendFileSync('results.txt', inputBytes.length + '\n');

                    console.log(`Iteration ${i}`);
                }
            });
        } catch (error) {
            console.error(error);
            console.log(`Iteration ${i}`);
        }
    }
}

(async () => {
    const [default_account, account2] = await initialize();
    console.log(default_account)
})();
