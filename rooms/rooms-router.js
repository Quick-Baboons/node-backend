// Initialize player
// Store current location in player-room 
// If current location not in room database, put it in


// Move (takes in a direction)

// wiseman object

// get player location info
// if player location.direction_room is not null or -1:
// add direction_room id to wiseman object


// use direction to make axios call for new room
// new room database opposite direction to player location (update room db)

// update old room direction to new room (update room db)

// add new room to database if doesn't exist

// update player current location


const router = require('express').Router();
const Rooms = require('./rooms-model.js');
const Players = require('../players/players-model.js');
const {
  validateRoomId,
  validatePostReqBody
} = require('../api/middleware.js')
const axios = require('axios')

// Use this object to print the opposite of a direction (e.g. oppositeDirection.n => 's')
const opposite = {
  n: 's',
  s: 'n',
  e: 'w',
  w: 'e'
}



router.get('/adlist', async (req, res) => {
  let rooms = await Rooms.find()
  let adlist = {}
  try{
    for(let room in rooms) {
      let room_id = rooms[room].room_id


      let n = {n: rooms[room].n}
      let s = {s:rooms[room].s}
      let e = {e: rooms[room].e}
      let w = {w:rooms[room].w}


      if(!adlist[room]) {
        adlist[room_id] = []
        if(n.n !== null && n.n !== -1) adlist[room_id].push(n)
        if(s.s !== null && s.s !== -1) adlist[room_id].push(s)
        if(e.e !== null && e.e !== -1) adlist[room_id].push(e)
        if(w.w !== null && w.w !== -1) adlist[room_id].push(w)
      }

    }
    res.json(adlist)

  }
  catch(e) {
    res.status(500).json(e)
  }

})

router.get('/players', (req, res) => {
  Players.find()
    .then(players => res.json(players))
    .catch(err => res.json(err))
})




// requires ---> {Authorization: 'Token 564738fhghgjfg...'}
router.get('/init', async (req, res) => {

  // grab token

  let token = req.headers.authorization
  // console.log(token)
  let auth = {
    headers: {
      Authorization: `Token ${token}`
    }
  }

  // This try catch is for Lambda's init. If error, it's from lambda, not our API
  try {


    // use init lambda function to get room data
    const player = await axios('https://lambda-treasure-hunt.herokuapp.com/api/adv/init/', auth);

    // grab player location from init endpoint and store it into player table
    let player_data = { 'current_room': player.data.room_id }
    await Players.edit(token, player_data)

    // this try catch is to find possible room on database based of player current info
    try {
      possible_room = await Rooms.findById(player.data.room_id)
      // console.log('possible_room', possible_room, player.data)
      // If room exists, return player data
      if(possible_room !== undefined) {
        return res.status(200).json({ player: player.data, message: "findbyId worked. Room already existed" })
      }

      // else if player current room not in db, add it to db
      else if (possible_room === undefined) {
        // processing
        let room_data = {}
        room_data['room_id'] = player.data.room_id
        room_data['title'] = player.data.title
        room_data['description'] = player.data.description
        room_data['coordinates'] = player.data.coordinates
        room_data['n'] = null
        room_data['s'] = null
        room_data['e'] = null
        room_data['w'] = null

        player.data.exits.forEach(exit => {
          room_data[exit] = -1
        })
        // add room to db
        try {
          let added_room = await Rooms.add(room_data)
          return res.status(200).json({ added_room: room_data['room_id'], message: "room did not exist. added room to db" })
        } catch {
          return res.status(500).json({ messsage: 'Could not add room to database' })
        }
      }


    } catch {
      return res.status(500).json({ message: "Database error while trying to find room" })
    }

  } catch (err) {
    // If lambda throws error
    return res.status(500).json({ err, message: "Error from lambda, init not working. Possibly add token?" });
  }
})

// move player to new room and return all data about that room
// INPUT: 'direction'

router.post('/move', async (req, res) => {
  let direction = req.body.direction


  // Grab token
  let token = req.headers.authorization
  let auth = {
      headers: {
        Authorization: `Token ${token}`
      }
    }
  console.log('body', req.body)
  // wiseman object
  let wiseman = {
    'direction': req.body.direction,
  }

  // get player location info, specifcally current room id
  let player = await Players.findById(token)
  // console.log('PLAYER', player) 
  // using player current room id, find that room in the database
  let last_room = await Rooms.findById(player.current_room)




  // using that room, find direction (n,s,e,w) req.body
  let possible_exit = last_room[direction]
  // console.log(player, last_room)
  // if last_room[req.body.direction] is not -1 or null, add to wiseman
  if (possible_exit !== -1 && possible_exit !== null) {
    wiseman['next_room_id'] = `${possible_exit}`
  }


  // We DON'T know the room id in direction we are moving
  // {
  //   'direction': 'n'
  // }
  // We know the room id in direction we are moving
  // {
  //   'direction': 'n'
  //   'next_room_id': 51
  // }




  try {
    // hit move endpoint with req.body.direction
    const newRoom = await axios.post('https://lambda-treasure-hunt.herokuapp.com/api/adv/move/', wiseman, auth);

    
    let newRoomData = newRoom.data

    // Initial state
    newRoomData['n'] = null
    newRoomData['s'] = null
    newRoomData['e'] = null
    newRoomData['w'] = null

    console.log('NEW ROOM DATA', newRoomData)

    // check database to see if room is there
    let newRoomExist = await Rooms.findById(newRoomData['room_id'])

    if(newRoomExist === undefined) {

  
      newRoomData.exits.forEach(exit => {
        newRoomData[exit] = -1
      })

      newRoomData[opposite[direction]] = last_room['room_id']
      // save to db

      delete newRoomData['players']
      delete newRoomData['exits']

      let itemsArr = newRoomData['items']
      let errorsArr = newRoomData['errors']
      let messagesArr = newRoomData['messages']
        

      newRoomData['items'] = ""
      newRoomData['errors'] = ""
      newRoomData['messages'] = ""

      itemsArr.forEach(item => {
        newRoomData['items'] = newRoomData['items'] + item +','
      })

      errorsArr.forEach(err => {
        newRoomData['errors'] = newRoomData['errors'] + err +','
      })
      messagesArr.forEach(message => {
        newRoomData['messages'] = newRoomData['messages'] + message +','
      })


      console.log(newRoomData)
      await Rooms.add(newRoomData)
      // Update last room direction value
      
    }

    else {
      newRoomData['n'] = newRoomExist['n']
      newRoomData['s'] = newRoomExist['s']
      newRoomData['e'] = newRoomExist['e']
      newRoomData['w'] = newRoomExist['w']
      newRoomData[opposite[direction]] = last_room['room_id']
      // save to db
      delete newRoomData['players']
      delete newRoomData['exits']

      let itemsArr = newRoomData['items']
      let errorsArr = newRoomData['errors']
      let messagesArr = newRoomData['messages']
        

      newRoomData['items'] = ""
      newRoomData['errors'] = ""
      newRoomData['messages'] = ""

      itemsArr.forEach(item => {
        newRoomData['items'] = newRoomData['items'] + item +','
      })

      errorsArr.forEach(err => {
        newRoomData['errors'] = newRoomData['errors'] + err +','
      })
      messagesArr.forEach(message => {
        newRoomData['messages'] = newRoomData['messages'] + message +','
      })
      await Rooms.edit(newRoomData['room_id'], newRoomData)
    }

    let updatedPlayerLocation = await Players.edit(token, {current_room:newRoomData.room_id})
    let updated = {
      [direction]: newRoomData['room_id']
    }


    await Rooms.edit(last_room['room_id'], updated)
    return res.status(200).json(newRoomData)

  } catch (e) {
    return res.status(500).json({e, message:"ERROR WITH AXIOS PROBABLY"});
  }
})



router.get('/', (req, res) => {
  Rooms.find()
    .then(rooms => {
      res.status(200).json(rooms)
    })
    .catch(err => {
      res.status(500).json({ message: 'Error retrieving the rooms.' })
      console.log(err)
    })
})

router.get('/:id', (req, res) => {
  const id = req.params.id
  Rooms.findById(id)
    .then(room => {
      res.status(200).json(room)
    })
    .catch(err => {
      res.status(500).json({ message: 'Error retrieving the room.' })
      console.log(err)
    })
})

router.post('/', validatePostReqBody, (req, res) => {
  const room = req.body
  Rooms.add(room)
    .then(id => {
      [newRoomId] = id
      return Rooms.findById(newRoomId)
    })
    .then(room => {
      res.status(201).json({ message: 'Successfully added the room.', room })
    })
    .catch(err => {
      res.status(500).json({ message: 'Error adding the room.' })
    })
})

router.put('/:id', (req, res) => {
  const id = req.params.id
  const updated = req.body
  Rooms.edit(id, updated)
    .then(updatedRoomId => {
      return Rooms.findById(updatedRoomId)
    })
    .then(updated => {
      res.status(201).json(updated)
    })
    .catch(err => {
      res.status(500).json({ message: 'Error updating the room.' })
    })
})

router.delete('/:id', (req, res) => {
  const id = req.params.id
  Rooms.remove(id)
    .then(deleted => {
      res.status(200).json({ message: 'Successfully removed the room.' })
    })
    .catch(err => {
      res.status(500).json({ message: 'Error removing the room.' })
    })
})







module.exports = router;
