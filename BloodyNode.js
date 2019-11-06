const NodeRSA = require('node-rsa');
const hash = require('object-hash');
const crypto = require('libp2p-crypto')
const sha256 = require('sha256')

class BloodyNode {
  constructor({ ipfs, blocks, initPrivateKey }) {
    if (!ipfs) {
      throw 'No IPFS'
    }
    if (!blocks) {
      throw 'No blocks'
    }
    this.key = {
      private: initPrivateKey
    }
    this.ipfs = ipfs
    this.peers = {}
    this.transactions = []
    this.tmpBlock = {
      transactions: []
    }
    this.blocks = blocks
  }
  async mineBlock(block) {
    const previousBlock = this.blocks[this.blocks.length - 1] ? this.blocks[this.blocks.length - 1] : false
    if (previousBlock) {
      let hash = ''
      const difficulty = 3
      let nonce = 0
      while (hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
        nonce++
        hash = sha256(nonce + previousBlock.hash + JSON.stringify(block)).toString()
      }
      block.hash = hash
      block.nonce = nonce
      block.previousHash = previousBlock.hash
      return block
    }
  }
  async encrypt(data) {
    const key = new NodeRSA(this.key.private, "pkcs1-private")
    return key.encryptPrivate(data, 'base64')
  }
  async decrypt(message) {
    const publicKeyString = this.peers[message.from]
    if (publicKeyString) {
      let publicKey = crypto.keys.unmarshalPublicKey(Buffer.from(publicKeyString, 'base64'))
      publicKey = {
        n: Buffer.from(publicKey._key.n, 'base64'),
        e: Buffer.from(publicKey._key.e, 'base64'),
      }
      let usefulPubKey = new NodeRSA()
      usefulPubKey.importKey(publicKey, 'components-public')
      const encrypted = message.data.toString()
      return usefulPubKey.decryptPublic(encrypted, 'utf8')
    } else {
      return false
    }
  }
  verifyTransaction(fromAddress, transaction) {
    if (fromAddress !== transaction.fromAddress) {
      return false
    }
    const amountToSend = transaction.amount
    const fee = transaction.fee
    let balance = this.balance(fromAddress)
    if (amountToSend + fee < balance) {
      return true
    } else {
      return false
    }
  }
  blockAlreadyExists(block) {
    return this.blocks.find(b => hash(b.transactions) === hash(block.transactions)) ? true : false
  }
  async addTransactionToTmpBlock(transactionMessage) {
    let transaction = JSON.parse(await this.decrypt(transactionMessage))
    if (transaction) {
      if (this.verifyTransaction(transactionMessage.from, transaction)) {
        this.tmpBlock.transactions.push(transaction)
      }
    }
    if (this.tmpBlock.transactions.length === BloodyNode.BLOCK_SIZE) {
      const block = await this.mineBlock(this.tmpBlock)
      if (!this.blockAlreadyExists(block)) {
        const message = await this.encrypt(JSON.stringify(block))
        await this.ipfs.pubsub.publish(BloodyNode.TOPIC_BLOCKS, message)
      }
      this.tmpBlock = { transactions: [] }
    }
  }
  async addTransaction(transactionMessage) {
    this.transactions.push(transactionMessage)
    if (this.tmpBlock.transactions.length < BloodyNode.BLOCK_SIZE) {
      this.addTransactionToTmpBlock(this.transactions.shift())
    }
  }
  async verifyBlock(blockMessage) {
    const decrypted = await this.decrypt(blockMessage)
    if (decrypted) {
      const block = JSON.parse(decrypted)
      const previousBlock = this.blocks[this.blocks.length - 1] ? this.blocks[this.blocks.length - 1] : false
      if (previousBlock) {
        const blockClone = Object.assign({}, block);
        delete blockClone.hash;
        delete blockClone.nonce;
        delete blockClone.previousHash;
        
        if (sha256(block.nonce + previousBlock.hash + JSON.stringify(blockClone)).toString() === block.hash) {
          if (!this.blockAlreadyExists(block)) {
            this.blocks.push(block)
          }
          return true
        } else {
          return false
        }
      } else {
        return false
      }
    } else {
      return false
    }
  }
  history() {
    return this.blocks.map(b => {
      const tmpBlock = Object.assign({}, b)
      tmpBlock.hash = Buffer.from(b.hash).toString()
      return tmpBlock
    })
  }
  balance(address) {
    let balance = 0
    for (let b of this.blocks) {
      for (let t of b.transactions) {
        if (t.fromAddress === address) {
          balance -= t.amount;
        }
        if (t.toAddress === address) {
          balance += t.amount;
        }
      }
    }
    return balance
  }
  async sendTransaction(transaction) {
    transaction.fromAddress = (await this.ipfs.id()).id
    transaction.timestamp = Date.now()
    if (!this.verifyTransaction(transaction.fromAddress, transaction)) {
      return false
    }
    const message = await this.encrypt(JSON.stringify(transaction))
    await this.ipfs.pubsub.publish(BloodyNode.TOPIC_TRANSACTIONS, message)
    return true
  }
  async start() {
    await this.ipfs.pubsub.subscribe(BloodyNode.TOPIC_TRANSACTIONS, this.addTransaction.bind(this))
    await this.ipfs.pubsub.subscribe(BloodyNode.TOPIC_BLOCKS, this.verifyBlock.bind(this))
    this.peers[(await this.ipfs.id()).id] = (await this.ipfs.id()).publicKey
    this.ipfs.libp2p.on('peer:connect', peerInfo => {
      const pubKey = peerInfo.id.marshalPubKey()
      if (pubKey) {
        this.peers[peerInfo.id._idB58String] = pubKey.toString('base64')
      }
    })
    return true
  }
  static async create({ ipfs, blocks, initPrivateKey }) {
    const node = new BloodyNode({
      ipfs: ipfs,
      blocks: blocks,
      initPrivateKey
    })
    await node.start()
    return node
  }
}

BloodyNode.TOPIC_TRANSACTIONS = 'TRANSACTIONS'
BloodyNode.TOPIC_BLOCKS = 'BLOCKS'
BloodyNode.BLOCK_SIZE = 1

module.exports = BloodyNode