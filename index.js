const BloodyNode = require('./BloodyNode.js')
const NodeRSA = require('node-rsa');
const sha256 = require('sha256')
const IPFS = require('ipfs')
const crypto = require('libp2p-crypto')
const PeerId = require('peer-id')

const fs = require('fs');
const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors')

const app = express()
app.use(bodyParser.json());
app.use(cors())

function createFromPrivKey(privateKey) {
  return new Promise(resolve => {
    PeerId.createFromPrivKey(crypto.keys.marshalPrivateKey(privateKey, 'rsa'), async (e, peerId) => {
      if (e) {
        console.log(err)
        return resolve(false)
      }
      resolve(peerId)
    })
  })
}

async function init(app) {
  const key = new NodeRSA({ b: 2048 });
  const initPrivateKey = key.exportKey('private')
  const initPubKey = key.exportKey('public')
  const privateKey = await crypto.keys.import(Buffer.from(initPrivateKey), null)
  const peerID = await createFromPrivKey(privateKey)
  const peerJSON = peerID.toJSON()

  process.stdout.write("Connecting to IPFS... ");
  const ipfs = await IPFS.create({
    silent: false,
    init: {
      privateKey: peerJSON.privKey,
    },
    EXPERIMENTAL: { ipnsPubsub: true },
    repo: './ipfs',
    config: {
      Addresses: {
        Swarm: [
          "/ip4/0.0.0.0/tcp/4001",
          "/ip6/::/tcp/4001"
        ],
      },
    }
    /* relay: {
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
    } */
  })
  process.stdout.write("OK\n");


  const peerId = (await ipfs.id()).id
  // TODO: now I'm generating the basic blockchain every time


  process.stdout.write("Making you rich... ");
  
  let blocks = []
  let genesisBlock = {
    transactions: [
      { fromAddress: '1h3h12ui3h1i2u3h1iu2hi12ui3h1ui23hi1u2h3iu1h23333', toAddress: peerId, amount: 1000, fee: 0 },
      { fromAddress: peerId, toAddress: '1h3h12ui3h1i2u3h1iu2hi12ui3h1ui23hi1u2h3iu1h23333', amount: 900, fee: 0 },
    ]
  }
  let hash = ''
  const difficulty = 3
  let nonce = 0
  while (hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
    nonce++
    hash = sha256(nonce + JSON.stringify(genesisBlock)).toString()
  }
  genesisBlock.hash = hash
  genesisBlock.nonce = nonce
  blocks.push(genesisBlock)
  process.stdout.write("OK\n");

  //const blocks = [{"transactions":[{"fromAddress":"1h3h12ui3h1i2u3h1iu2hi12ui3h1ui23hi1u2h3iu1h23333","toAddress":"QmVe3zDyfmNRUDMR3eg9BQJk88RhosxKgwKWDSxH67Tjdd","amount":1000,"fee":0},{"fromAddress":"QmVe3zDyfmNRUDMR3eg9BQJk88RhosxKgwKWDSxH67Tjdd","toAddress":"1h3h12ui3h1i2u3h1iu2hi12ui3h1ui23hi1u2h3iu1h23333","amount":900,"fee":0}],"hash":{"type":"Buffer","data":[0,0,1,110,54,223,196,71,60,148,207,97,72,144,42,18]}}]

  process.stdout.write("Initializing the node... ");
  const node = await BloodyNode.create({
    ipfs: ipfs,
    blocks: blocks,
    initPrivateKey,
    initPubKey
  })
  process.stdout.write("OK\n");

  const a = node.encrypt('message')

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
  process.stdout.write(`\nWallet API available at http://localhost:8888\n\nYour public hash is: ${(await ipfs.id()).id}\n`);
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

