const fs = require('fs');
const path = require('path');
const colors = require('colors');
const clear = require('console-clear');
const figlet = require('figlet');
const Table = require('cli-table3');
const readlineSync = require('readline-sync');
const { 
    getSessionToken, 
    getUserInfo, 
    getWallets, 
    claimRewards, 
    startFarming, 
    getSubTasks, 
    autoCompleteTask,
    claimTaskPoints,
    getDailyVisits,
    performDailyCheckIn,
    loadTokens,
    saveTokens
} = require('./tools/apis');

// Ruta al archivo UserQuerys.json
const queriesFilePath = path.join(__dirname, 'UserQuerys.json');

// Constante para omitir ciertas tareas
const skipTasks = [5, 9]; // IDs de tareas que no deben auto completarse

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
            await delay(500);
        }

        if (usersData.length === 0) {
            console.log("No valid user accounts found.".red);
            return;
        }

        // Mostrar la tabla con todos los usuarios
        showUserDataTable(usersData, 'MT');

        // Bucle del menú para todas las cuentas
        let exitProgram = false;
        while (!exitProgram) {
            console.log("\nMenu:");
            console.log("1. 💰 Claim Rewards");
            console.log("2. 🌱 Start Farming");
            console.log("3. 🤖 Auto Complete Tasks");
            console.log("4. 🗓️  Perform Daily Check-In");
            console.log("0. 🚪 Exit");

            const choice = readlineSync.question('\nPlease select an option: '.cyan);

            switch (choice) {
                case '1':
                    console.log("\n💰 Claiming Rewards for all users...");
                    await claimFarmingRewardsForAll(usersData, 'MT');
                    await delay(500);
                    break;
                case '2':
                    console.log("\n🌱 Starting Farming for all users...");
                    await startFarmingForAll(usersData, 'MT');
                    await delay(500);
                    break;
                case '3':
                    console.log("\n🤖 Auto Completing Tasks for all users...");
                    await autoCompleteTasks(usersData, 'MT');
                    await delay(500);
                    break;
                case '4':
                    console.log("\n🗓️ Performing Daily Check-In for all users...");
                    await performDailyCheckInForAll(usersData, 'MT');
                    await delay(500);
                    break;
                case '0':
                    console.log("Good Bye 👋".green);
                    exitProgram = true;
                    break;
                default:
                    console.log("❌ Invalid option. Please try again.\n".red);
                    break;
            }
        }
    } else {
        console.log("No queries found in UserQuerys.json".red);
    }
}

// Funciones auxiliares

async function claimFarmingRewardsForAll(usersData, coin) {
    for (let user of usersData) {
        await claimFarmingRewards(user, coin);
        await delay(500);
    }
}

async function startFarmingForAll(usersData, coin) {
    for (let user of usersData) {
        if (!user.walletId) {
            console.error(`Wallet ID not found for ${user.username}. Skipping farming...`.red);
            continue;
        }
        await initiateFarming(user, coin);
        await delay(500);
    }
}

async function autoCompleteTasks(usersData, coin) {
    console.log(`🤖 Auto Completing Tasks for all users`.yellow);
    for (let user of usersData) {
        const { sessionToken, username, queryId } = user;
        console.log(`🟡 Auto Completing Tasks for ${username}`.yellow);
        try {
            const tasks = await getSubTasks(sessionToken);
            if (!tasks || tasks.length === 0) {
                console.log(`🎉 All Tasks have been processed for ${username} your points are now ${user.balance} ${coin}`.green);
                continue;
            }

            let allTasksProcessed = true;

            for (let task of tasks) {
                const { recourceId, title, reward, done, claimed, id } = task;

                // Verifica si la tarea está en skipTasks
                if (skipTasks.includes(recourceId)) {
                    console.log(`🔸 Task ${recourceId} - ${title} is skipped from auto-completion`.yellow);
                    continue;
                }

                if (done && claimed) {
                    console.log(`🟣 Task ${recourceId} - ${title} is already completed`.magenta);
                    continue;
                }
                
                if (!done && !claimed) {
                    console.log(`🔄 Completing Task ${recourceId} - ${title} for ${reward} ${coin} Points`.blue);
                    try {
                        const completeResponse = await autoCompleteTask(sessionToken, recourceId);
                        if (completeResponse && completeResponse.id && /^\d+$/.test(completeResponse.id)) {
                            // Reclamar los puntos de la tarea completada
                            const claimResponse = await claimTaskPoints(sessionToken, id);
                            if (claimResponse && claimResponse.id && /^\d+$/.test(claimResponse.id)) {
                                console.log(`✅ Task ${recourceId} - ${title} Has been completed you got ${reward} ${coin} Points`.green);
                            } else {
                                console.log(`🔴 Failed to claim points for task ID ${id}`.red);
                            }
                        } else {
                            console.log(`🔴 Task ${recourceId} - ${title} can't be completed manually. Please do it yourself`.red);
                            allTasksProcessed = false;
                        }
                    } catch (error) {
                        const errorNumber = error.response && error.response.status ? error.response.status : 'Unknown';
                        if (errorNumber === 400) {
                            console.log(`🔴 Task ${recourceId} - ${title} can't be completed manually. Please do it yourself`.red);
                        } else if (errorNumber === 401) {
                            console.log(`🟠 Access Token is Expired or Invalid for ${username} - Generating a new Token...`.yellow);
                            user.sessionToken = await getSessionTokenFromQueries(queryId, user.id - 1);
                            tokens[user.id - 1] = user.sessionToken;
                            saveTokens(tokens);
                            await delay(500);
                            await autoCompleteTasks([user], coin);
                            continue;
                        } else {
                            console.log(`🔴 Error completing Task ${recourceId} - ${title}: ${error.message}`.red);
                        }
                    }
                    await delay(500);
                }
            }

            if (allTasksProcessed) {
                // Obtener el nuevo balance después de completar todas las tareas
                try {
                    const wallets = await getWallets(user.sessionToken);
                    if (!wallets || wallets.length === 0) {
                        console.error("Could not fetch wallets information.".red);
                        continue;
                    }
                    const newBalanceValue = wallets[0].balance;
                    user.balance = newBalanceValue; // Actualizar el balance localmente
                    console.log(`🎉 All Tasks have been processed for ${username} your points are now ${newBalanceValue} ${coin}`.green);
                } catch (error) {
                    console.error("Error fetching wallets information.".red);
                }
            }
        } catch (error) {
            const errorNumber = error.response && error.response.status ? error.response.status : 'Unknown';
            if (errorNumber === 401) {
                console.log(`🟠 Access Token is Expired or Invalid for ${user.username} - Generating a new Token...`.yellow);
                user.sessionToken = await getSessionTokenFromQueries(queryId, user.id - 1);
                tokens[user.id - 1] = user.sessionToken;
                saveTokens(tokens);
                await delay(500);
                await autoCompleteTasks([user], coin);
            } else {
                console.log(`🔴 Error Auto Completing Tasks for ${user.username} - ${errorNumber}`.red);
            }
        }

        await delay(500);
    }
}

async function performDailyCheckInForAll(usersData, coin) {
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
                user.sessionToken = await getSessionTokenFromQueries(queryId, user.id - 1);
                tokens[user.id - 1] = user.sessionToken;
                saveTokens(tokens);
                await delay(500);
                await performDailyCheckInForAll([user], coin);
                continue;
            } else {
                console.log(`🔴 ${username} didn't perform Check-In successfully (Error ${errorNumber})`.red);
            }
        }
        await delay(500);
    }
}

// Funciones adicionales para manejo de tokens y operaciones
async function getSessionTokenFromQueries(queryId, accountIndex) {
    return await getSessionToken(queryId, accountIndex);
}

async function initiateFarming(userData, coin) {
    const { sessionToken, username, queryId, walletId } = userData;
    console.log(`🔗 Starting Farming for ${username}...`.cyan);
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
            userData.sessionToken = await getSessionTokenFromQueries(queryId, userData.id - 1);
            tokens[userData.id - 1] = userData.sessionToken;
            saveTokens(tokens);
            await delay(500);
            await initiateFarming(userData, coin);
        } else {
            console.log(`🔴 Error Starting Farming - ${errorNumber}`.red);
        }
    }
}

async function claimFarmingRewards(userData, coin) {
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
            userData.sessionToken = await getSessionTokenFromQueries(queryId, userData.id - 1);
            tokens[userData.id - 1] = userData.sessionToken;
            saveTokens(tokens);
            await delay(500);
            await claimFarmingRewards(userData, coin);
        } else {
            console.log(`🔴 Error Claiming Rewards - ${errorNumber}`.red);
        }
    }
}

main();
