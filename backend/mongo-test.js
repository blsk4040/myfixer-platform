// mongo-test.js
const dns = require('dns');
const { MongoClient } = require('mongodb');

// FORCE STABLE DNS (important)
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const uri =
'mongodb+srv://myfixer_app:XJjVGq1PQEmuDVBV@cluster0.ypbsaw2.mongodb.net/myfixer?retryWrites=true&w=majority&appName=Cluster0';

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
});

async function run() {
  try {
    await client.connect();
    console.log('CONNECTED');

    const result = await client.db('admin').command({ ping: 1 });
    console.log('PING OK', result);

  } catch (err) {
    console.error('FAILED:', err);
  } finally {
    await client.close();
  }
}

run();