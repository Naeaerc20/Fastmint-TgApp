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
    claimTaskPoints: claimTaskPointsAPI
} = require('./tools/apis');

// Define la constante skipTasks con los IDs de tareas que no deben auto completarse
const skipTasks = [5, 9]; // Añade aquí los recourceId que deseas omitir

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
    const { sessionToken, username, queryId, walletId } = userData;
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
            userData.sessionToken = await getSessionTokenFromQueries(queryId);
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

// Función para reclamar puntos de tareas completadas
async function claimTaskPoints(sessionToken, taskId) {
    try {
        const claimResponse = await claimTaskPointsAPI(sessionToken, taskId);
        if (claimResponse && claimResponse.id && /^\d+$/.test(claimResponse.id)) {
            console.log(`✅ Points successfully claimed for task ID ${taskId}`.green);
        } else {
            console.log(`🔴 Failed to claim points for task ID ${taskId}`.red);
        }
    } catch (error) {
        console.error(`🔴 Error claiming task points: ${error.message}`.red);
    }
}

// Función para auto completar las tareas
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
                            const claimResponse = await claimTaskPoints(sessionToken, id); // Usar el 'id' para reclamar
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
                            user.sessionToken = await getSessionTokenFromQueries(queryId);
                            if (user.sessionToken) {
                                await delay(500);
                                await autoCompleteTasks([user], coin);
                                continue; // Salir para evitar múltiples reintentos
                            } else {
                                console.error("Could not obtain the session token.".red);
                            }
                        } else {
                            console.log(`🔴 Error completing Task ${recourceId} - ${title}: ${error.message}`.red);
                        }
                    }
                    // Esperar 500 ms antes de continuar con la siguiente tarea
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
                user.sessionToken = await getSessionTokenFromQueries(user.queryId);
                if (user.sessionToken) {
                    await delay(500);
                    await autoCompleteTasks([user], coin);
                } else {
                    console.error("Could not obtain the session token.".red);
                }
            } else {
                console.log(`🔴 Error Auto Completing Tasks for ${user.username} - ${errorNumber}`.red);
            }
        }

        // Esperar 500 ms antes de proceder a la siguiente cuenta
        await delay(500);
    }
}

// Función para reclamar recompensas para todos los usuarios
async function claimFarmingRewardsForAll(usersData, coin) {
    for (let user of usersData) {
        await claimFarmingRewards(user, coin);
        // Esperar 500 ms antes de proceder al siguiente usuario
        await delay(500);
    }
}

// Función para iniciar farming para todos los usuarios
async function startFarmingForAll(usersData, coin) {
    for (let user of usersData) {
        if (!user.walletId) {
            console.error(`Wallet ID not found for ${user.username}. Skipping farming...`.red);
            continue;
        }
        await initiateFarming(user, coin);
        // Esperar 500 ms antes de proceder al siguiente usuario
        await delay(500);
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

    if (queries.length > 0) {
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
            console.log("0. 🚪 Exit");

            const choice = readlineSync.question('\nPlease select an option: '.cyan);

            switch (choice) {
                case '1':
                    console.log("\n💰 Claiming Rewards for all users...");
                    await claimFarmingRewardsForAll(usersData, 'MT');
                    // Esperar 500 ms después de la acción
                    await delay(500);
                    break;
                case '2':
                    console.log("\n🌱 Starting Farming for all users...");
                    await startFarmingForAll(usersData, 'MT');
                    // Esperar 500 ms después de la acción
                    await delay(500);
                    break;
                case '3':
                    console.log("\n🤖 Auto Completing Tasks for all users...");
                    await autoCompleteTasks(usersData, 'MT');
                    // Esperar 500 ms después de la acción
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

main();




