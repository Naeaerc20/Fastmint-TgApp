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
    startFarming, 
    getDailyVisits,
    performDailyCheckIn,
    loadTokens,
    saveTokens
} = require('./tools/apis'); // Asegúrate de que la ruta sea correcta

// Ruta al archivo UserQuerys.json
const queriesFilePath = path.join(__dirname, 'UserQuerys.json');

// Demoras en milisegundos
const DELAY_BETWEEN_ACCOUNTS = 500; // 500 ms
const DELAY_BETWEEN_ACTIONS = 60 * 1000; // 1 minuto
const DELAY_BETWEEN_CYCLES = 7 * 60 * 60 * 1000; // 7 horas

// Constante para omitir ciertas tareas (aunque ya no se usan)
const skipTasks = []; // Vacío, ya que eliminamos todo relacionado con tareas

// Función para leer las consultas desde UserQuerys.json
function readQueries() {
    if (fs.existsSync(queriesFilePath)) {
        try {
            const data = fs.readFileSync(queriesFilePath, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            console.error('Error reading UserQuerys.json'.red, err.message);
            return [];
        }
    } else {
        console.error('UserQuerys.json not found'.red);
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

// Función para introducir una demora
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Función principal para ejecutar la aplicación
async function main() {
    showBanner();
    showWelcomeMessages();

    const queries = readQueries();

    // Cargar tokens existentes
    let tokens = loadTokens();

    if (queries.length > 0) {
        let usersData = [];

        // Obtener datos de todas las cuentas
        for (let index = 0; index < queries.length; index++) {
            const queryId = queries[index];
            let sessionToken = tokens[index]; // Intentar obtener el token existente

            // Si no hay token, obtener uno nuevo
            if (!sessionToken) {
                try {
                    sessionToken = await getSessionToken(queryId, index); // Pasar el índice de cuenta
                } catch (error) {
                    console.error(`Error obtaining session token for queryId: ${queryId}`.red, error.message);
                    continue; // Pasar al siguiente account
                }
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
            await delay(DELAY_BETWEEN_ACCOUNTS);
        }

        if (usersData.length === 0) {
            console.log("No valid user accounts found.".red);
            return;
        }

        // Mostrar la tabla con todos los usuarios
        showUserDataTable(usersData, 'MT');

        // Iniciar el ciclo de automatización
        await startAutomationCycle(usersData, 'MT', tokens);
    } else {
        console.log("No queries found in UserQuerys.json".red);
    }
}

// Función para iniciar los ciclos de automatización
async function startAutomationCycle(usersData, coin, tokens) {
    let cycleCount = 1;

    while (true) {
        console.log(`\n--- Starting Cycle ${cycleCount} ---`.cyan);

        if (cycleCount === 1) {
            // Ciclo 1: Check-In, Claim Rewards, Start Farming
            console.log("\n🗓️ Performing Daily Check-In for all users...");
            await performDailyCheckInForAll(usersData, coin, tokens);
            await delay(DELAY_BETWEEN_ACTIONS);

            console.log("\n💰 Claiming Rewards for all users...");
            await claimFarmingRewardsForAll(usersData, coin, tokens);
            await delay(DELAY_BETWEEN_ACTIONS);

            console.log("\n🌱 Starting Farming for all users...");
            await startFarmingForAll(usersData, coin, tokens);
        } else {
            // Ciclos 2 y 3: Claim Rewards, Start Farming
            console.log("\n💰 Claiming Rewards for all users...");
            await claimFarmingRewardsForAll(usersData, coin, tokens);
            await delay(DELAY_BETWEEN_ACTIONS);

            console.log("\n🌱 Starting Farming for all users...");
            await startFarmingForAll(usersData, coin, tokens);
        }

        // Calcular el tiempo actual y el tiempo de inicio del próximo ciclo
        const nextCycleTime = new Date(Date.now() + DELAY_BETWEEN_CYCLES);
        console.log(`\n⏳ Next cycle will start at ${nextCycleTime.toLocaleString()}\n`.yellow);

        // Esperar 7 horas antes de iniciar el siguiente ciclo
        await delay(DELAY_BETWEEN_CYCLES);

        // Incrementar el contador de ciclos
        cycleCount++;
        if (cycleCount > 3) {
            cycleCount = 1; // Reiniciar el contador después de Ciclo 3
        }
    }
}

// Función para realizar el Check-In diario para todas las cuentas
async function performDailyCheckInForAll(usersData, coin, tokens) {
    for (let user of usersData) {
        const { sessionToken, username, queryId } = user;
        console.log(`🟡 Performing Daily Check-In for ${username}`.yellow);
        try {
            // Obtener el estado de las visitas diarias
            let dailyVisits = await getDailyVisits(sessionToken);
            if (dailyVisits) {
                // Encontrar el siguiente día sin completar
                const nextVisit = dailyVisits.visits.find(visit => !visit.isCompleted);
                if (nextVisit) {
                    const day = nextVisit.day;
                    // Realizar el Check-In incluyendo las solicitudes adicionales
                    const updatedDailyVisits = await performDailyCheckIn(sessionToken, day);
                    if (updatedDailyVisits) {
                        // Encontrar el último día completado después del Check-In
                        const lastCompletedVisit = updatedDailyVisits.visits.filter(visit => visit.isCompleted).pop();
                        if (lastCompletedVisit) {
                            console.log(`✅ ${username} performed Check-In successfully`.green);
                            console.log(`✅ Check-In Day ${lastCompletedVisit.day} - Claimed successfully ${lastCompletedVisit.rewardMnt} ${coin} points`.green);
                        } else {
                            console.log(`✅ ${username} performed Check-In successfully, but could not retrieve updated day.`.green);
                        }
                    } else {
                        console.log(`🔴 ${username} didn't perform Check-In successfully`.red);
                    }
                } else {
                    console.log(`🟢 ${username} has already completed all Check-In days`.green);
                }
            } else {
                console.log(`🔴 Could not retrieve daily visits for ${username}`.red);
            }
        } catch (error) {
            const errorNumber = error.response && error.response.status ? error.response.status : 'Unknown';
            if (errorNumber === 401) {
                console.log(`🟠 Access Token is Expired or Invalid for ${username} - Generating a new Token...`.yellow);
                user.sessionToken = await getSessionToken(queryId, user.id - 1);
                tokens[user.id - 1] = user.sessionToken;
                saveTokens(tokens);
                await delay(DELAY_BETWEEN_ACCOUNTS);
                await performDailyCheckInForAll([user], coin, tokens);
                continue;
            } else {
                console.log(`🔴 ${username} didn't perform Check-In successfully (Error ${errorNumber})`.red);
            }
        }
        await delay(DELAY_BETWEEN_ACCOUNTS);
    }
}

// Función para reclamar recompensas para todas las cuentas
async function claimFarmingRewardsForAll(usersData, coin, tokens) {
    for (let user of usersData) {
        await claimFarmingRewards(user, coin, tokens);
        await delay(DELAY_BETWEEN_ACCOUNTS);
    }
}

// Función para reclamar recompensas de una cuenta específica
async function claimFarmingRewards(userData, coin, tokens) {
    const { sessionToken, username, walletId, queryId } = userData;
    console.log(`💰 Claiming Farming Rewards for ${username}...`.cyan);
    try {
        const claimResponse = await claimRewards(sessionToken, walletId);
        if (claimResponse && claimResponse.id && claimResponse.id === walletId) {
            const wallets = await getWallets(sessionToken);
            if (!wallets || wallets.length === 0) {
                console.error("Could not fetch wallets information after claiming rewards.".red);
                return;
            }
            const newBalanceValue = wallets[0].balance;
            userData.balance = newBalanceValue;

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
            userData.sessionToken = await getSessionToken(queryId, userData.id - 1);
            tokens[userData.id - 1] = userData.sessionToken;
            saveTokens(tokens);
            await delay(DELAY_BETWEEN_ACCOUNTS);
            await claimFarmingRewards(userData, coin, tokens);
        } else {
            console.log(`🔴 Error Claiming Rewards - ${errorNumber}`.red);
        }
    }
}

// Función para iniciar el farming para todas las cuentas
async function startFarmingForAll(usersData, coin, tokens) {
    for (let user of usersData) {
        if (!user.walletId) {
            console.error(`Wallet ID not found for ${user.username}. Skipping farming...`.red);
            continue;
        }
        await initiateFarming(user, coin, tokens);
        await delay(DELAY_BETWEEN_ACCOUNTS);
    }
}

// Función para iniciar el farming de una cuenta específica
async function initiateFarming(userData, coin, tokens) {
    const { sessionToken, username, queryId, walletId } = userData;
    console.log(`🌱 Starting Farming for ${username}...`.cyan);
    try {
        const farmResponse = await startFarming(sessionToken, walletId);
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
            userData.sessionToken = await getSessionToken(queryId, userData.id - 1);
            tokens[userData.id - 1] = userData.sessionToken;
            saveTokens(tokens);
            await delay(DELAY_BETWEEN_ACCOUNTS);
            await initiateFarming(userData, coin, tokens);
        } else {
            console.log(`🔴 Error Starting Farming - ${errorNumber}`.red);
        }
    }
}

// Función para formatear milisegundos a un formato legible
function formatMilliseconds(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

main();
