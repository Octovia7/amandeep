import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';

await connectDb(env.mongoUri);
createApp().listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
