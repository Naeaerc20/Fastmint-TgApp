const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Rutas a los archivos
const queriesFilePath = path.join(__dirname, '..', 'UserQuerys.json');
const tokensFilePath = path.join(__dirname, '..', 'sessionTokens.txt');

// Función para obtener el token de sesión
async function getSessionToken(queryId) {
    try {
        const response = await axios.post('https://api.chaingn.org/auth/login', {
            OAuth: queryId
        });

        if (response.status === 200) {
            const sessionToken = response.data.sessionToken;
            saveToken(sessionToken);
            return sessionToken;
        } else {
            return null;
        }
    } catch (error) {
        throw error;
    }
}

// Función para guardar el token en sessionTokens.txt
function saveToken(token) {
    let tokens = [];

    if (fs.existsSync(tokensFilePath)) {
        try {
            const tokensData = fs.readFileSync(tokensFilePath, 'utf-8');
            tokens = JSON.parse(tokensData);
        } catch (err) {
            return;
        }
    }

    tokens.push(token);

    try {
        fs.writeFileSync(tokensFilePath, JSON.stringify(tokens, null, 2));
    } catch (err) {
        // No imprimir errores aquí
    }
}

// Función para obtener información del usuario
async function getUserInfo(sessionToken) {
    try {
        const response = await axios.get('https://api.chaingn.org/user', {
            headers: {
                Authorization: `Bearer ${sessionToken}`
            }
        });

        if (response.status === 200) {
            return response.data;
        } else {
            return null;
        }
    } catch (error) {
        throw error;
    }
}

// Función para obtener información de wallets
async function getWallets(sessionToken) {
    try {
        const response = await axios.get('https://api.chaingn.org/wallets', {
            headers: {
                Authorization: `Bearer ${sessionToken}`
            }
        });

        if (response.status === 200) {
            return response.data;
        } else {
            return null;
        }
    } catch (error) {
        throw error;
    }
}

// Función para reclamar recompensas
async function claimRewards(sessionToken, userId) {
    try {
        const response = await axios.post('https://api.chaingn.org/wallet/claim', { id: userId }, {
            headers: {
                Authorization: `Bearer ${sessionToken}`
            }
        });

        if (response.status === 200) {
            return response.data; // Debería ser algo como { "id": "437673" }
        } else {
            return null;
        }
    } catch (error) {
        throw error;
    }
}

// Función para iniciar el farming con el ID de la wallet
async function startFarming(sessionToken, walletId) {
    try {
        const response = await axios.post('https://api.chaingn.org/wallet/farm', { id: walletId }, {
            headers: {
                Authorization: `Bearer ${sessionToken}`
            }
        });

        if (response.status === 200) {
            return response.data; // Debería ser algo como { "id": "529099" }
        } else {
            return null;
        }
    } catch (error) {
        throw error;
    }
}

// Función para obtener la lista de tareas disponibles
async function getSubTasks(sessionToken) {
    try {
        const response = await axios.get('https://api.chaingn.org/sub_tasks', {
            headers: {
                Authorization: `Bearer ${sessionToken}`
            }
        });

        if (response.status === 200) {
            return response.data; // Debería ser un arreglo de tareas
        } else {
            return null;
        }
    } catch (error) {
        throw error;
    }
}

// Función para auto completar una tarea
async function autoCompleteTask(sessionToken, recourceId) {
    try {
        const response = await axios.post('https://api.chaingn.org/sub_task', {
            recourceId: recourceId
        }, {
            headers: {
                Authorization: `Bearer ${sessionToken}`
            }
        });

        if (response.status === 200) {
            return response.data; // Debería ser algo como { "id": "803920" }
        } else {
            return null;
        }
    } catch (error) {
        throw error;
    }
}

// Función para reclamar puntos de tareas completas
async function claimTaskPoints(sessionToken, taskId) {
    try {
        const response = await axios.put('https://api.chaingn.org/sub_task/claim', {
            id: taskId
        }, {
            headers: {
                Authorization: `Bearer ${sessionToken}`
            }
        });

        if (response.status === 200) {
            return response.data; // Debería ser algo como { "id": "803920" }
        } else {
            return null;
        }
    } catch (error) {
        throw error;
    }
}

module.exports = { 
    getSessionToken, 
    getUserInfo, 
    getWallets, 
    claimRewards, 
    startFarming, 
    getSubTasks, 
    autoCompleteTask,
    claimTaskPoints
};
