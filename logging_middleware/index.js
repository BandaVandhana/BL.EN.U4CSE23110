const axios = require('axios');

const BASE_URL = 'http://20.207.122.201/evaluation-service';

/**
 * Reusable Log function
 * @param {string} stack - 'frontend' or 'backend'
 * @param {string} level - 'debug', 'info', 'warn', 'error', 'fatal'
 * @param {string} pkg - 'api', 'component', 'hook', 'page', 'state', 'style', 'auth', 'config', 'middleware', 'utils', etc.
 * @param {string} message - Descriptive message
 * @param {string} token - The access_token
 */
const Log = async (stack, level, pkg, message) => {
    const validStacks = ['backend', 'frontend'];
    const validLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
    
    if (!validStacks.includes(stack) || !validLevels.includes(level)) {
        return;
    }

    // Attempt to read token from environment (supports both frontend Next.js and typical backend env vars)
    const token = process.env.NEXT_PUBLIC_AUTH_TOKEN || process.env.AUTH_TOKEN || "";

    try {
        await axios.post(
            `${BASE_URL}/logs`,
            {
                stack: stack,
                level: level,
                package: pkg,
                message: message
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
    } catch (error) {
        // Silent fail as requested by instructions
    }
};

module.exports = { Log };
