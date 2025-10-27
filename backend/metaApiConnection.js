import MetaApi from 'metaapi-cloud-sdk-js';

// Credentials are now loaded from environment variables for security.
const token = process.env.META_API_TOKEN;
const accountId = process.env.META_API_ACCOUNT_ID;

let connection = null;

// Add a check for credentials early
if (!token || !accountId) {
    console.error("FATAL: META_API_TOKEN and META_API_ACCOUNT_ID environment variables must be set.");
}

const api = new MetaApi(token);

export async function getConnection() {
    if (connection) {
        return connection;
    }

    if (!token || !accountId) {
        throw new Error("MetaAPI credentials are not configured in server environment variables.");
    }
    
    try {
        console.log('Connecting to MetaApi account...');
        const account = await api.metatraderAccountApi.getAccount(accountId);
        
        // Wait for account to be deployed
        if (account.state !== 'DEPLOYED') {
            await account.deploy();
            await account.waitDeployed();
        }

        console.log('Creating RPC connection...');
        connection = account.getRPCConnection();
        await connection.connect();

        // Wait for the connection to be synchronized
        console.log('Waiting for SDK to synchronize with terminal...');
        await connection.waitSynchronized();

        console.log('MetaAPI Connection established and synchronized.');
        return connection;
    } catch (error) {
        console.error('MetaAPI connection failed:', error);
        connection = null; // Reset on failure
        throw error;
    }
}