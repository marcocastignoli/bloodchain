const BloodyNode = require('./BloodyNode.js')
const NodeRSA = require('node-rsa');
const pow = require('proof-of-work');
const IPFS = require('ipfs')

const fs = require('fs');
const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors')

const app = express()
app.use(bodyParser.json());
app.use(cors())

async function init(app) {
  process.stdout.write("Connecting to IPFS... ");
  const ipfs = await IPFS.create({
    silent: true,
    EXPERIMENTAL: { ipnsPubsub: true },
    repo: './ipfs',
    relay: {
      enabled: true
    },
    config: {
      "Addresses": {
        "Swarm": [
          '/ip4/51.75.30.53/tcp/4004/ws/ipfs/QmUeLcCfeR33xGcR8DBta2gG8EcfZ9UygLxLdaXMYQMzFA'
        ],
        "API": "",
        "Gateway": ""
      },
      "Discovery": {
        "MDNS": {
          "Enabled": false,
          "Interval": 10
        },
        "webRTCStar": {
          "Enabled": true
        }
      }
    }
  })
  process.stdout.write("OK\n");

  
  // TODO: now I'm generating the basic blockchain every time
  process.stdout.write("Making you rich... ");
  const ipfs_id = (await ipfs.id()).id
  const solver = new pow.Solver();
  let blocks = []
  let genesisBlock = {
    transactions: [
      { fromAddress: '1h3h12ui3h1i2u3h1iu2hi12ui3h1ui23hi1u2h3iu1h23333', toAddress: 'QmVe3zDyfmNRUDMR3eg9BQJk88RhosxKgwKWDSxH67Tjdd', amount: 1000, fee: 0 },
      { fromAddress: 'QmVe3zDyfmNRUDMR3eg9BQJk88RhosxKgwKWDSxH67Tjdd', toAddress: '1h3h12ui3h1i2u3h1iu2hi12ui3h1ui23hi1u2h3iu1h23333', amount: 900, fee: 0 },
    ]
  }
  const prefix = Buffer.from(JSON.stringify(genesisBlock), 'hex');
  const nonce = solver.solve(17, prefix);
  genesisBlock.hash = nonce
  blocks.push(genesisBlock)
  process.stdout.write("OK\n");

  process.stdout.write("Initializing the node... ");
  if (!fs.readFileSync('./private_key') || !fs.readFileSync('./public_key')) {
    process.stdout.write(`ERR: you have to run "npm run gen-key" to create public and private key!\n`);
  }
  const node = await BloodyNode.create({
    ipfs: ipfs,
    key: {
      private: fs.readFileSync('./private_key'),
      public: fs.readFileSync('./public_key')
    },
    blocks: blocks
  })
  process.stdout.write("OK\n");

  app.post('/transaction', async function (req, res) {
    if (req.body.amount && req.body.recipient) {
      const transactionResult = await node.sendTransaction({
        toAddress: req.body.recipient,
        amount: req.body.amount,
        fee: 1
      })
      return res.send(JSON.stringify({
        success: transactionResult,
        info: !transactionResult && 'balance not sufficent'
      }))
    } else {
      return res.send(JSON.stringify({
        success: false,
        info: 'Missing fields'
      }))
    }
  })
  app.get('/history', async function (req, res) {
    const history = node.history()
    return res.send(JSON.stringify(history))
  })
  app.get('/balance', async function (req, res) {
    const balance = node.balance((await node.ipfs.id()).id)
    return res.send(JSON.stringify(balance))
  })
  app.listen(8888)
  process.stdout.write(`\nWallet API available at http://localhost:8888\n\nYour public hash is: ${(await ipfs.id()).id}`);
}

console.log(`
▄▄▄▄    ██▓     ▒█████   ▒█████  ▓█████▄  ▄████▄   ██░ ██  ▄▄▄       ██▓ ███▄    █ 
▓█████▄ ▓██▒    ▒██▒  ██▒▒██▒  ██▒▒██▀ ██▌▒██▀ ▀█  ▓██░ ██▒▒████▄    ▓██▒ ██ ▀█   █ 
▒██▒ ▄██▒██░    ▒██░  ██▒▒██░  ██▒░██   █▌▒▓█    ▄ ▒██▀▀██░▒██  ▀█▄  ▒██▒▓██  ▀█ ██▒
▒██░█▀  ▒██░    ▒██   ██░▒██   ██░░▓█▄   ▌▒▓▓▄ ▄██▒░▓█ ░██ ░██▄▄▄▄██ ░██░▓██▒  ▐▌██▒
░▓█  ▀█▓░██████▒░ ████▓▒░░ ████▓▒░░▒████▓ ▒ ▓███▀ ░░▓█▒░██▓ ▓█   ▓██▒░██░▒██░   ▓██░
░▒▓███▀▒░ ▒░▓  ░░ ▒░▒░▒░ ░ ▒░▒░▒░  ▒▒▓  ▒ ░ ░▒ ▒  ░ ▒ ░░▒░▒ ▒▒   ▓▒█░░▓  ░ ▒░   ▒ ▒ 
▒░▒   ░ ░ ░ ▒  ░  ░ ▒ ▒░   ░ ▒ ▒░  ░ ▒  ▒   ░  ▒    ▒ ░▒░ ░  ▒   ▒▒ ░ ▒ ░░ ░░   ░ ▒░
░    ░   ░ ░   ░ ░ ░ ▒  ░ ░ ░ ▒   ░ ░  ░ ░         ░  ░░ ░  ░   ▒    ▒ ░   ░   ░ ░ 
░          ░  ░    ░ ░      ░ ░     ░    ░ ░       ░  ░  ░      ░  ░ ░           ░ 
     ░                            ░      ░                                         

Welcome to Bloodchain, this is a - totally not for production - blockchain.
It was Halloween 2019 and I was bored so I decided to learn how blockchains work!

Send a transaction: 
curl -X POST  http://localhost:8888/transaction

Check your balance:
curl -X GET  http://localhost:8888/balance

Check bloodychain's history:
curl -X GET  http://localhost:8888/history

`)
init(app)

