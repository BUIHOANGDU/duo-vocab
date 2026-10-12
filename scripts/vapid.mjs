import webpush from 'web-push';
const keys=webpush.generateVAPIDKeys();
console.log('Copy these into your private .env file. Never commit or share the private key.');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}`);
