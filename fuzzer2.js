const Web3 = require('web3');
const fs = require('fs');

// Connect to your fork of the geth client
const web3 = new Web3("http://localhost:8545"); // Replace the URL with your geth client's RPC URL
// console.log(web3);
// console.log('reached');

var account1;
var account2;
var contractAddress;
var contractInstance;

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
    account1 = '0x83643Fd7cc5e3ED4Bae1298B1a96A4C29818DD5d';
    account2 = '0xd1A78aFCDc6ed3Cc2acEDfEe8858DE84626305a1';

    // const account1 = (await web3.eth.getAccounts())[0];
    // const account2 = (await web3.eth.getAccounts())[1];

    // Load the smart contract ABI and bytecode
    const abi = JSON.parse(fs.readFileSync('ABI_ERC20.json', 'utf8'));
    // bytecode

    const bytecode = fs.readFileSync('bytecode.txt', 'utf8');

    // bytcode = JSON.parse(data)
    usdcContract = await new web3.eth.Contract(abi);
    const options = {
        data: bytecode,
        gas: 10000000
    }

    console.log(options.data)

    const arguments = [web3.utils.toWei('0', 'ether')]
    contractInstance = await usdcContract.deploy(options, arguments)
        .send({ from: account1, gas: '1000000' });
    console.log('reached');

    // Deploy the smart contract
    // 0 gas?
}

async function fuzzUsdc(accountFrom, accountTo, contractInstance) {
    const action = ['transfer', 'approve', 'transferFrom'][Math.floor(Math.random() * 3)];
    const value = web3.utils.toWei(Math.floor(Math.random() * 1000).toString(), 'ether');

    if (action === 'transfer') {
        const txHash = await contractInstance.methods.transfer(accountTo, value).send({ from: accountFrom });
    } else if (action === 'approve') {
        const txHash = await contractInstance.methods.approve(accountTo, value).send({ from: accountFrom });
    } else if (action === 'transferFrom') {
        const allowance = await contractInstance.methods.allowance(accountFrom, accountTo).call();
        if (allowance > 0) {
            const transferValue = BigInt(value) > BigInt(allowance) ? allowance : value;
            const txHash = await contractInstance.methods.transferFrom(accountFrom, accountTo, transferValue).send({ from: account1 })
                .on('transactionHash', (hash) => {
                    return hash;
                })
        }
    }
}

async function loop() {
    for (let i = 0; i < 100; i++) {
        await fuzzUsdc(account1, account2, contractInstance);
        // Log or store the transaction data and state changes here
        console.log(`Iteration ${i}`);
    }
    // Write the collected data into a file for later analysis
}

(async () => {
    await initialize();
    await loop();
})();
