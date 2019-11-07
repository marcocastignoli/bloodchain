const dotenv = require('dotenv');
dotenv.config();

const BloodyNode = require('./BloodyNode.js')
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
  const initPrivateKey = fs.readFileSync('./private_key')
  const privateKey = await crypto.keys.import(Buffer.from(initPrivateKey), null)
  const peerID = await createFromPrivKey(privateKey)
  const peerJSON = peerID.toJSON()

  process.stdout.write("Connecting to IPFS... ");
  const ipfs = await IPFS.create({
    silent: true,
    init: {
      privateKey: peerJSON.privKey,
    },
    EXPERIMENTAL: { ipnsPubsub: true },
    repo: './ipfs',
    config: {
      Addresses: {
        Swarm: [
          `/ip4/0.0.0.0/tcp/${process.env.IPFS_PORT}`,
          `/ip6/::/tcp/${process.env.IPFS_PORT}`
        ],
      },
    }
  })
  process.stdout.write("OK\n");

  let blocks = JSON.parse(fs.readFileSync('./blockchain'))

  process.stdout.write("Initializing the node... ");
  const node = await BloodyNode.create({
    ipfs: ipfs,
    blocks: blocks,
    initPrivateKey
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
  app.listen(process.env.HTTP_PORT)
  process.stdout.write(`
Wallet API available at http://localhost:${process.env.HTTP_PORT}
    
Your public hash is: ${(await ipfs.id()).id}

These are your addresses:
`);
  ipfs._peerInfo.multiaddrs.forEach(element => console.log(element.toString()))
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
curl -X POST  http://localhost:${process.env.HTTP_PORT}/transaction

Check your balance:
curl -X GET  http://localhost:${process.env.HTTP_PORT}/balance

Check bloodychain's history:
curl -X GET  http://localhost:${process.env.HTTP_PORT}/history

`)
init(app)

