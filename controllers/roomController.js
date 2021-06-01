const Room = require('../models/room');
const User = require('../models/user');
const userModule = require('../modules/userModule');

module.exports = {
    async createRoom(req, res) {
        const user = await userModule.getUser(req.session.user.id);
        if (user.roomId) {
            return res.status(409).send({
                success: false,
                error: 'User already joined room'
            });
        }
        try {
            const room = await Room.create({
                owner: req.session.user.id,
                members: [req.session.user.id],
                private: req.query.private
            });
            await User.findOneAndUpdate({
                id: req.session.user.id
            }, {
                $set: {
                    roomId: room._id
                }
            });
            return res.send({
                success: true,
                status: 'Room created'
            });
        } catch {
            return res.send({
                success: false,
                status: 'Error occurred'
            });
        }
    },
    async getRooms(req, res) {
        return res.send({
            success: true,
            result: await Room.find({
                private: false
            })
        });
    },
    async joinRoom(req, res) {
        const user = await userModule.getUser(req.session.user.id);
        if (user.roomId) {
            return res.status(409).send({
                success: false,
                error: 'User already joined room'
            });
        }
        const members = (await Room.findById(req.params.id)).members;
        if (members.length !== 1) {
            return res.status(403).send({
                success: false,
                error: 'Room is full'
            });
        }
        try {
            const room = await Room.findByIdAndUpdate(req.params.id, {
                $push: {
                    members: req.session.user.id
                },
            });
            if (!room) {
                return res.send({
                    success: false,
                    error: 'Invalid room id'
                });
            }
            req.session.user.roomId = room._id;
            await userModule.updateUser(req.session.user);
            return res.send({
                success: true,
                status: 'User joined room'
            });
        } catch {
            return res.send({
                success: false,
                status: 'Error occurred'
            });
        }
    },
    async deleteRoom(req, res) {
        const room = await Room.findById(req.params.id);
        if (room.owner === req.session.user.id) {
            try {
                const room = await Room.findByIdAndDelete(req.params.id);
                if (!room) {
                    return res.send({
                        success: false,
                        error: 'Invalid room id'
                    });
                }
                for (const userId of room.members) {
                    await User.findOneAndUpdate({
                        id: userId
                    }, {
                        $set: {
                            roomId: null
                        }
                    });
                }
                return res.send({
                    success: true,
                    status: 'Room deleted'
                });
            } catch {
                return res.send({
                    success: false,
                    status: 'Error occurred'
                });
            }
        } else {
            return res.status(403).send({
                success: false,
                error: 'Forbidden'
            });
        }
    }
}