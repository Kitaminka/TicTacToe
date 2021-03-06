const Room = require('../models/room');
const User = require('../models/user.js');
require('../modules/userModule');

const rooms = new Map;
const winPositions = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [1, 4, 7], [2, 5, 8], [3, 6, 9], [1, 5, 9], [3, 5, 7]];

module.exports = (io) => {
    io.sockets.on('connection', (socket) => {
        if (!rooms.get(socket.request.session.user.roomId)) {
            rooms.set(socket.request.session.user.roomId, {
                gameState: 0,
                xTurns: [],
                oTurns: [],
                roomId: socket.request.session.user.roomId,
                xPlayer: socket.id
            });
        } else {
            let roomInfo = rooms.get(socket.request.session.user.roomId);

            if (roomInfo.oPlayer) return socket.disconnect;

            roomInfo.oPlayer = socket.id;
            roomInfo.gameState = 1
        }

        let roomInfo = rooms.get(socket.request.session.user.roomId);

        if (roomInfo.gameState === 1) {
            io.emit('gameStart', roomInfo);
            io.emit('firstTurn', roomInfo);
        }
        socket.on('move', (moveInfo) => {
            if (![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(moveInfo)) return;
            if (roomInfo.xTurns.includes(moveInfo) || roomInfo.oTurns.includes(moveInfo)) return;
            if ((roomInfo.gameState === 1 && roomInfo.xPlayer === socket.id) || (roomInfo.gameState === 2 && roomInfo.oPlayer === socket.id)) {
                if (roomInfo.gameState === 1) roomInfo.xTurns.push(moveInfo);
                else roomInfo.oTurns.push(moveInfo);

                io.emit('moveInfo', {
                    move: moveInfo,
                    gameState: roomInfo.gameState,
                    roomId: socket.request.session.user.roomId
                });

                let xCount = 0;
                let oCount = 0;
                let xWin = false;
                let oWin = false;

                for (const winPositionsArr of winPositions) {
                    for (const winPosition of winPositionsArr) {
                        for (const move of roomInfo.xTurns) {
                            if (winPosition === move) xCount++;
                        }
                    }
                    if (xCount === winPositionsArr.length) {
                        xWin = true;
                    }
                    xCount = 0;
                }

                if (!xWin) {
                    for (const winPositionsArr of winPositions) {
                        for (const winPosition of winPositionsArr) {
                            for (const move of roomInfo.oTurns) {
                                if (winPosition === move) oCount++;
                            }
                        }
                        if (oCount === winPositionsArr.length) {
                            oWin = true;
                        }
                        oCount = 0;
                    }
                }

                if (xWin) {
                    roomInfo.winner = roomInfo.xPlayer;
                    io.emit('gameEnd', {
                        winner: roomInfo.winner,
                        loser: socket.id
                    });
                } else if (oWin) {
                    roomInfo.winner = roomInfo.oPlayer;
                    io.emit('gameEnd', {
                        winner: roomInfo.winner,
                        loser: socket.id
                    });
                }

                if (roomInfo.gameState === 1) {
                    roomInfo.gameState = 2;
                    io.emit('secondTurn', roomInfo);
                } else {
                    roomInfo.gameState = 1;
                    io.emit('firstTurn', roomInfo);
                }
            }
        });
        socket.on('disconnect', async () => {
            if (!roomInfo.winner) {
                let winner;

                if (roomInfo.xPlayer === socket.id) {
                    winner = roomInfo.oPlayer;
                } else {
                    winner = roomInfo.xPlayer;
                }

                io.emit('gameEnd', {
                    winner: winner,
                    loser: socket.id
                });
            }
            const room = await Room.findByIdAndDelete(socket.request.session.user.roomId);
            if (room.members[0] === socket.request.session.user.id) {
                await User.findOneAndUpdate({
                    id: room.members[1]
                }, {
                    $set: {
                        roomId: null
                    }
                });
            } else {
                await User.findOneAndUpdate({
                    id: room.members[0]
                }, {
                    $set: {
                        roomId: null
                    }
                });
            }
        });
    });
}