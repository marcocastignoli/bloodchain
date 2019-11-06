# Bloodchain
Welcome to Bloodchain, this is a - totally not for production - blockchain.
It was Halloween 2019 and I was bored so I decided to learn how blockchains work!

Send a transaction: 
curl -X POST  http://localhost:8888/transaction

Check your balance:
curl -X GET  http://localhost:8888/balance

Check bloodychain's history:
curl -X GET  http://localhost:8888/history

## Install

Install with npm or Yarn
```
yarn Install
```

Generate private key, it outputs your ipfs id
```
yarn gen-key
```

```
mv .env.example .env
```
and edit it!

If you are not using an existing blockchain you have to generate it.
Before that set GENESIS_BLOCK_PEER=your_ipfs_id (output of yarn key-gen)

```
yarn gen-blocks
```

## Start
```
yarn start
```

If you regenerate your key remember to remove the ipfs folder
