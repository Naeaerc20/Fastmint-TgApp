const fs = require('fs');
const path = require('path');
const colors = require('colors');
const clear = require('console-clear');
const figlet = require('figlet');
const Table = require('cli-table3');
const { 
    getSessionToken, 
    getUserInfo, 
    getWallets, 
    claimRewards, 
    startFarming 
} = require('./tools/apis');

// Ruta al archivo UserQuerys.json
const queriesFilePath = path.join(__dirname, 'UserQuerys.json');

// Función para leer las consultas desde UserQuerys.json
function readQueries() {
    if (fs.existsSync(queriesFilePath)) {
        try {
            const data = fs.readFileSync(queriesFilePath, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            console.error('Error leyendo UserQuerys.json'.red, err.message);
            return [];
        }
    } else {
        console.error('UserQuerys.json no encontrado'.red);
        return [];
    }
}

// Función para mostrar el banner usando figlet
function showBanner() {
    clear(true); // Limpia la consola
    const banner = figlet.textSync('Fastmint AutoBot', {
        horizontalLayout: 'default',
        verticalLayout: 'default'
    });
    console.log(banner.green);
}

// Función para mostrar los mensajes de bienvenida
function showWelcomeMessages() {
    console.log('👋 Hello! Fellow'.yellow);
    console.log('👾 Script Created by Naeaex'.yellow);
    console.log('📩 Social: www.x.com/naeaex_dev - www.github.com/Naeaerc20'.yellow);
    console.log('⏳ We\'re getting your data... Please Wait!\n'.yellow);
}

// Función para mostrar los datos de múltiples usuarios en una tabla formateada
function showUserDataTable(usersData, coin) {
    const table = new Table({
        head: ['ID', 'Username', `${coin} Collected`, `${coin} Farming`],
        colWidths: [5, 20, 20, 20],
        style: {
            head: ['cyan'],
            border: ['grey']
        }
    });

    usersData.forEach(user => {
        table.push([user.id, user.username, `${user.balance} ${coin}`, `${user.reward} ${coin}`]);
    });

    console.log(table.toString());
}

// Función para obtener y mostrar los datos del usuario
async function fetchAndShowUserData(sessionToken, userData, coin) {
    try {
        const wallets = await getWallets(sessionToken);
        if (!wallets || wallets.length === 0) {
            console.error(`Could not fetch wallets information for ${userData.username}.`.red);
            return;
        }
        const wallet = wallets[0];
        userData.walletId = wallet.id; // Almacenar walletId
        userData.balance = wallet.balance;
        userData.reward = wallet.info.reward;
    } catch (error) {
        console.error(`Error fetching wallets information for ${userData.username}.`.red);
    }
}

// Función para obtener un nuevo token desde las consultas
async function getSessionTokenFromQueries(queryId) {
    return await getSessionToken(queryId);
}

// Función para iniciar el farming
async function initiateFarming(userData, coin) {
    const { sessionToken, username, walletId } = userData;
    console.log(`🔗 Starting Farming for ${username}...`.cyan);
    try {
        const farmResponse = await startFarming(sessionToken, walletId); // Pasar walletId
        if (farmResponse && farmResponse.id && /^\d+$/.test(farmResponse.id)) {
            console.log(`🟢 Farming successfully started for ${username}`.green);
            await fetchAndShowUserData(sessionToken, userData, coin);
        } else {
            console.log(`🔴 Error Starting Farming for ${username} - Invalid response.`.red);
        }
    } catch (error) {
        const errorNumber = error.response && error.response.status ? error.response.status : 'Unknown';
        if (errorNumber === 400) {
            console.log(`🔴 Farming has already begun. Please wait to claim rewards and restart...`.red);
        } else if (errorNumber === 500) {
            console.log(`🔴 Farming already started for ${username} - Please wait to claim rewards`.red);
        } else if (errorNumber === 401) {
            console.log(`🟠 Access Token is Expired or Invalid for ${username} - Generating a new Token...`.yellow);
            // Generar un nuevo token
            userData.sessionToken = await getSessionTokenFromQueries(userData.queryId);
            if (userData.sessionToken) {
                // Esperar 500 ms antes de reintentar
                await delay(500);
                // Reintentar iniciar el farming
                await initiateFarming(userData, coin);
            } else {
                console.error("Could not obtain the session token.".red);
            }
        } else {
            console.log(`🔴 Error Starting Farming - ${errorNumber}`.red);
        }
    }
}

// Función para reclamar recompensas
async function claimFarmingRewards(userData, coin) {
    const { sessionToken, username, walletId } = userData; // Usa walletId en lugar de queryId
    console.log(`💰 Claiming Farming Rewards for ${username}...`.cyan);
    try {
        const claimResponse = await claimRewards(sessionToken, walletId); // Asegúrate de usar el walletId correcto
        if (claimResponse && claimResponse.id && claimResponse.id === walletId) { // Compara con el ID de respuesta
            // Obtener el nuevo balance después de reclamar la recompensa
            const wallets = await getWallets(sessionToken);
            if (!wallets || wallets.length === 0) {
                console.error("Could not fetch wallets information after claiming rewards.".red);
                return;
            }
            const newBalanceValue = wallets[0].balance; // Asumiendo que el balance está en el primer wallet
            userData.balance = newBalanceValue; // Actualiza el balance localmente

            console.log(`🟢 Reward successfully claimed for ${username} - Your MT balance is now ${newBalanceValue}`.green);
        } else {
            console.log(`🔴 Error Claiming Rewards - Invalid response.`.red);
        }
    } catch (error) {
        const errorNumber = error.response && error.response.status ? error.response.status : 'Unknown';
        if (errorNumber === 400) {
            console.log(`🔴 You already have claimed Rewards. Please start farming first`.red);
        } else if (errorNumber === 401) {
            console.log(`🟠 Access Token is Expired or Invalid for ${username} - Generating a new Token...`.yellow);
            userData.sessionToken = await getSessionTokenFromQueries(userData.queryId);
            if (userData.sessionToken) {
                await delay(500);
                await claimFarmingRewards(userData, coin);
            } else {
                console.error("Could not obtain the session token.".red);
            }
        } else {
            console.log(`🔴 Error Claiming Rewards - ${errorNumber}`.red);
        }
    }
}

// Función para ejecutar las acciones de reclamar recompensas y farming
async function executeActions(usersData, coin) {
    console.log("\n💰 Claiming Rewards for all users...");
    for (let user of usersData) {
        await claimFarmingRewards(user, coin);
        await delay(5000); // Esperar 5 segundos entre cada usuario
    }

    console.log("\n🌱 Starting Farming for all users...");
    for (let user of usersData) {
        await initiateFarming(user, coin);
        await delay(5000); // Esperar 5 segundos entre cada usuario
    }
}

// Función para introducir una demora
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Función principal para ejecutar la aplicación
async function main() {
    showBanner();
    showWelcomeMessages();

    const queries = readQueries();
    if (queries.length === 0) {
        console.log("No queries found in UserQuerys.json".red);
        return;
    }

    let usersData = [];
    // Obtener datos de todas las cuentas
    for (let [index, queryId] of queries.entries()) {
        let sessionToken;
        try {
            sessionToken = await getSessionToken(queryId);
        } catch (error) {
            console.error(`Error obtaining session token for queryId: ${queryId}`.red, error.message);
            continue; // Pasar al siguiente account
        }

        if (!sessionToken) {
            console.error(`Could not obtain the session token for queryId: ${queryId}`.red);
            continue; // Pasar al siguiente account
        }

        // Obtener información del usuario
        let userInfo;
        try {
            userInfo = await getUserInfo(sessionToken);
            if (!userInfo) {
                console.error(`Could not fetch user information for queryId: ${queryId}`.red);
                continue; // Pasar al siguiente account
            }
        } catch (error) {
            console.error(`Error fetching user information for queryId: ${queryId}`.red, error.message);
            continue; // Pasar al siguiente account
        }

        const username = userInfo.username;
        const coin = 'MT'; // Asumiendo que la moneda es siempre MT

        // Obtener y almacenar datos iniciales del usuario
        let userData = {
            id: index + 1,
            username: username,
            sessionToken: sessionToken,
            queryId: queryId,
            balance: 0,
            reward: 0,
            walletId: null // Inicializar walletId
        };

        await fetchAndShowUserData(sessionToken, userData, coin);
        usersData.push(userData);

        // Esperar 500 ms antes de procesar la siguiente cuenta
        await delay(500);
    }

    // Mostrar la tabla con todos los usuarios
    showUserDataTable(usersData, 'MT');

    while (true) {
        await executeActions(usersData, 'MT');
        
        // Esperar 6 horas y 30 minutos
        console.log("\n⏳ Waiting for 6 hours and 30 minutes before the next execution...".yellow);
        await delay(6.5 * 60 * 60 * 1000); // 6 horas y 30 minutos en milisegundos
    }
}

main();
