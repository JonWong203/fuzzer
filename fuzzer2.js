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
    console.log("Balance: " + balance);

    await web3.eth.personal.newAccount('password123').then((address) => {
        account1 = address
        addressToPassword.set(address, 'password123')
    }); // Prints the new account address

    await web3.eth.personal.newAccount('hello').then((address) => {
        account2 = address
        addressToPassword.set(address, 'hello')
    })


    console.log(account1)
    console.log(account2)

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
    .on('transactionHash', function (transactionHash) {
        console.log("Transaction hash:", transactionHash);
    })
    .on('receipt', function (receipt) {
        console.log(receipt);
        // Call loop() function after the contract is deployed
    })
    .on('error', function (error) {
        console.error(error);
    })
    .catch(function (error) {
        console.error(error);
    });

console.log('reached');
loop(contractInstance); // Pass contractInstance to loop
return [default_account, account1, contractInstance];
}

async function fuzzUsdc(accountFrom, accountTo, contractInstance) {
    // const action = ['transfer', 'approve', 'transferFrom'][Math.floor(Math.random() * 3)];
    const action = ['transfer', 'approve'][Math.floor(Math.random() * 2)];
    const value = web3.utils.toWei(Math.floor(Math.random() * 1000).toString(), 'ether');

    console.log(action)

    if (action === 'transfer') {
        console.log("here")
        const txHash = await web3.eth.personal.unlockAccount(accountFrom, addressToPassword.get(accountFrom), 60)
            .then(() => {
                contractInstance.methods.transfer(accountTo, value).send({ from: accountFrom });
            })
            .catch(console.error);
    } else if (action === 'approve') {
        console.log(83)
        const txHash = await web3.eth.personal.unlockAccount(accountFrom, addressToPassword.get(accountFrom), 60)
            .then(() => {
                contractInstance.methods.approve(accountTo, value).send({ from: accountFrom });
            })
            .catch(console.error);
    } else if (action === 'transferFrom') {
        console.log(90)
        const allowance = await contractInstance.methods.allowance(accountFrom, accountTo).call();
        if (allowance > 0) {
            const transferValue = BigInt(value) > BigInt(allowance) ? allowance : value;
            const txHash = await contractInstance.methods.transferFrom(accountFrom, accountTo, transferValue).send({ from: account1 })
                // returns the transaction hash
                .on('transactionHash', (hash) => {
                    return hash;
                })
        }
    }
}

async function loop(contractInstance) {
    for (let i = 0; i < 10; i++) {
        // fuzzUsdc now returns the transaction hash
        var txHash = await fuzzUsdc(default_account, account1, contractInstance);
        web3.eth.getTransaction(txHash, (error, tx) => {
            if (error) {
                console.log(error)
            } else {
                // tx.input is the call data
                var txData = tx.input
                // adds a newline to it
                fs.appendFileSync('results.txt', txData + '\n')
            }
        })
        // Log or store the transaction data and state changes here
        console.log(`Iteration ${i}`);
    }
    // Write the collected data into a file for later analysis
}

(async () => {
    const [default_account, account2] = await initialize();
    console.log(default_account)
})();
