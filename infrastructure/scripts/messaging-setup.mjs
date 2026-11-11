import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const directory=new URL('../../.local/',import.meta.url),destination=new URL('mobile-configuration.env',directory);
await mkdir(directory,{recursive:true});
await writeFile(destination,`NOTIFICATION_CONTACT_KEY=${randomBytes(32).toString('hex')}\n# Add your private Twilio account settings after creating the account.\n# TWILIO_ACCOUNT_SID=\n# TWILIO_API_KEY_SID=\n# TWILIO_API_KEY_SECRET=\n# TWILIO_VERIFY_SERVICE_SID=\n# TWILIO_SMS_FROM=\n# TWILIO_MESSAGING_SERVICE_SID=\n# TWILIO_WHATSAPP_FROM=\n# TWILIO_WHATSAPP_CONTENT_SID=\n# Notification delivery requires a public HTTPS WEB_ORIGIN.\nNOTIFICATION_DAILY_VERIFICATION_LIMIT=100\nNOTIFICATION_DAILY_USER_LIMIT=20\nNOTIFICATION_DAILY_GLOBAL_LIMIT=200\n`,{flag:'wx',mode:0o600});
console.log('Created private mobile notification configuration: '+fileURLToPath(destination));
console.log('Existing files are never overwritten. Copy settings into your private environment and restart the API after provider setup.');
