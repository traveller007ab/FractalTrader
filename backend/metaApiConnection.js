import MetaApi from 'metaapi-cloud-sdk-js';

// It is strongly recommended to use environment variables for security.
const token = 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI0MzgwNjM2NWNkMjNiMjIzOGU0Y2Y1YTFkMDY0MmE1ZCIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiXSwicmVzb3VyY2VzIjpbImFjY291bnQ6JFVTRVJfSUQkOjYxOWYwODY2LTFmMTAtNDFlNy1iZmE4LTA0OWViYzY5NTRiYiJdfSx7ImlkIjoibWV0YWFwaS1yZXN0LWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiYWNjb3VudDokVVNFUl9JRCQ6NjE5ZjA4NjYtMWYxMC00MWU3LWJmYTgtMDQ5ZWJjNjk1NGCiJdfSx7ImlkIjoibWV0YWFwaS1ycGMtYXBpIiwibWV0aG9kcyI6WyJtZXRhYXBpLWFwaTp3czpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiYWNjb3VudDokVVNFUl9JRCQ6NjE5ZjA4NjYtMWYxMC00MWU3LWJmYTgtMDQ5ZWJjNjk1NGCiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiNDM4MDYzNjVjZDIzYjIyMzhlNGNmNWExZDA2NDJhNWQiLCJpYXQiOjE3NjE1MTcwMTYsImV4cCI6MTc2OTI5MzAxNn0.YJ2dELUl64x0US4UrmBLV2Qb0Q6jmv6MPFGUEEk35lJuo4EGEFYCIfSwNvyPVZxnY9zlUhjOW-JM-8YNqXholJ2PG7Lx4Gtqb5qWR3OIS53bDaM2jL9eynMfD3lgiJx-_w2hz-ywpj2w1iM6lmjJoAAFGCBAQtbUETx_yYrZb9CIJuBA11SXga_Lepl-I-vj-VuN1GBgDsLLPLUovpt-3xkbNG9OBzegsDFINVGrbabWwdWt01PZDhlhYj3wURa1rXwHjA05fyBH3gl-MEE_suoU7CWJKDAuUC2_idjvU-25a5Z_FL_OnuJEq_zgYNpx37j9S9hJJUux9kpN7-BFjn9ODqL12KO-0OAb3dMWB_1NuqfnA5zjZhVqsr-Mn6xE-KJkayxZkun_zm1nRNsZrXXwwOu1Ambo5WBmAWqsr1blfD0mV6C_LtGm7UL78z6iwKWZxGqxUjKQOFbtTaip6YrFiIZDxCHWaIpSQHeZM-ekfFTcXisrxK1qPRrvvfT19mSW5vmHiosSVpZzxnpxz-N66-urekuf0hNoVs6isDAuAxiFj5W-m7h3VqWP0z2l2ENFSv6CmO9LlyXpR3s5ECh_0q8IfcXFnLvRjXmHBrbQgB9Mt3Mk2Q3y2SgLmdeNWnjbl7reAwIQEIHxEwPFEyGPgwFc73W7EkHxYplRaj8';
const accountId = '619f0866-1f10-41e7-bfa8-049ebc6954bb';

let connection = null;
const api = new MetaApi(token);

export async function getConnection() {
    if (connection) {
        return connection;
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
