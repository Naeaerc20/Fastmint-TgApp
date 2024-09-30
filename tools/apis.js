const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Rutas a los archivos
const queriesFilePath = path.join(__dirname, '..', 'UserQuerys.json');
const tokensFilePath = path.join(__dirname, '..', 'sessionTokens.txt');

// Función para cargar los tokens desde sessionTokens.txt
function loadTokens() {
    let tokens = [];
    if (fs.existsSync(tokensFilePath)) {
        try {
            const tokensData = fs.readFileSync(tokensFilePath, 'utf-8');
            tokens = JSON.parse(tokensData);
        } catch (err) {
            console.error('Error loading tokens:', err.message);
        }
    }
    return tokens;
}

// Función para guardar los tokens en sessionTokens.txt
function saveTokens(tokens) {
    try {
        fs.writeFileSync(tokensFilePath, JSON.stringify(tokens, null, 2));
    } catch (err) {
        console.error('Error saving tokens:', err.message);
    }
}

// Función para obtener el token de sesión
async function getSessionToken(queryId, accountIndex) {
    try {
        const response = await axios.post('https://api.chaingn.org/auth/login', {
            OAuth: queryId
        });

        if (response.status === 200) {
            const sessionToken = response.data.sessionToken;
            // Cargar tokens existentes
            let tokens = loadTokens();
            // Actualizar o agregar el token en la posición correspondiente
            tokens[accountIndex] = sessionToken;
            // Guardar los tokens actualizados
            saveTokens(tokens);
            return sessionToken;
        } else {
            return null;
        }
    } catch (error) {
        throw error;
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
async function claimRewards(sessionToken, walletId) {
    try {
        const response = await axios.post('https://api.chaingn.org/wallet/claim', { id: walletId }, {
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

// Función para iniciar el farming con el ID de la wallet
async function startFarming(sessionToken, walletId) {
    try {
        const response = await axios.post('https://api.chaingn.org/wallet/farm', { id: walletId }, {
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

// Función para obtener la lista de tareas disponibles
async function getSubTasks(sessionToken) {
    try {
        const response = await axios.get('https://api.chaingn.org/sub_tasks', {
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
            return response.data;
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
            return response.data;
        } else {
            return null;
        }
    } catch (error) {
        throw error;
    }
}

// Función para obtener el estado de las visitas diarias
async function getDailyVisits(sessionToken) {
    try {
        const response = await axios.get('https://api.chaingn.org/user/daily_visits', {
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

// Función genérica para realizar una solicitud GET a una URL específica con las cookies necesarias
async function performGetRequestWithCookies(url, sessionToken, day) {
    try {
        const headers = {
            'Cookie': `sessionToken=${sessionToken}; subscribed=${day}; isVisitToday=true`,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        };

        const response = await axios.get(url, { headers });

        if (response.status === 200) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        // Algunos sitios redirigen tras la autenticación, consideramos código 302 como éxito
        if (error.response && (error.response.status === 302 || error.response.status === 303)) {
            return true;
        }
        throw error;
    }
}

// Función para realizar el Check-In diario, incluyendo las solicitudes adicionales
async function performDailyCheckIn(sessionToken, day) {
    const urls = [
        `https://chaingn.org/home?_rsc=yv7o1`,
        `https://chaingn.org/wallet?_rsc=1ccoy`,
        `https://chaingn.org/tasks?_rsc=1ccoy`,
        `https://chaingn.org/upgrade?_rsc=1ccoy`,
        `https://chaingn.org/team?_rsc=1ccoy`
    ];

    for (let url of urls) {
        const success = await performGetRequestWithCookies(url, sessionToken, day);
        if (!success) {
            return false;
        }
    }

    // Después de realizar todas las solicitudes, obtenemos de nuevo el estado de las visitas
    const dailyVisits = await getDailyVisits(sessionToken);
    if (dailyVisits) {
        return dailyVisits;
    } else {
        return false;
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
    claimTaskPoints,
    getDailyVisits,
    performDailyCheckIn,
    loadTokens,
    saveTokens
};
