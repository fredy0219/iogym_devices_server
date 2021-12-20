require('dotenv').config()

const { response } = require('express');
const express = require('express');
const http = require('http')
const socketIo = require("socket.io");
const {Cable, Dumbbell, Barbell} = require('./Client')

const port = process.env.PORT || process.env.D_PORT;
const app = express();

const server = http.createServer(app);
const io = socketIo(server, {
  cors:{
      origin: "*"
  }
}); // < Interesting!

// const deviceServerPort = 53099;
// const deviceApp = express();
// const deviceServer = http.createServer(deviceApp)

// const deviceio = socketIo(deviceServer, {
//   cors:{
//       origin: "*"
//   }
// }); // < Interesting!

const jwt = require('jsonwebtoken');
const auth = require('./auth');

const clients = new Map(); 
let nfc_booking_state = {'barbell':false,
                      'cable_right':false,
                      'dumbbell':false}

const work_type_list = {'barbell':['barbell_bench_press','barbell_squats','barbell_bent_over_row'],
                    'cable_right':['chest_fly','seated_high_row','standing_lat_pulldown'],
                    'dumbbell':['goblet_squat','lateral_raise','biceps_curl','triceps_extension','shoulder_press']};

// let deviceSocketio = null;
// deviceio.on('connection', (socket)=>{
//   console.log("New device client connected " + socket.id);

//   deviceSocketio = socket;

//   socket.on('disconnect', () =>{
//     console.log("client disconnect" + socket.id);
//     deviceSocketio = null
//     socket.disconnect(true);
//   });

//   socket.on('add_dumbbell', (message) =>{
//     console.log('add dumbbell' , socket.id)

//     const dumbbells = JSON.parse(message)["dumbbell_weight"]

//     clients.forEach( (client)=>{

//       if(client instanceof Dumbbell){

//         // const dumbbells = message.dumbbell_weight
//         dumbbells.forEach( (value) =>{
//           client.add_dumbbell(value);
//         });
//       }
//     });
    
    
//   });

//   socket.on('dumbbell_training_result', (message)=>{
//     console.log('dumbbell_training_result' , message)

//     clients.forEach( (client)=>{

//       if(client instanceof Dumbbell){
//         client.add_training_result(message)
//       }
//     });

//   });

// });

// --------------------------------------------------
// Handle connection event
io.on('connection', (socket)=>{
  console.log("New client connected " + socket.id);

  //
  socket.on('disconnect', () =>{
    console.log("client disconnect" + socket.id);

    let client = clients.get(socket.id);

    if(client !== undefined){
      clearInterval(client.callback)
      clients.delete(socket.id)

      switch(client.constructor){
        case Dumbbell:
          nfc_booking_state['dumbbell'] = false;
          break;
        case Barbell:
          nfc_booking_state['barbell'] = false;
          break;
        case Cable:
          nfc_booking_state['cable_right'] = false;
          break;
      }
      
    }
    socket.disconnect(true);
  });

  // - NFC Connect
  socket.on('nfc_connect', (message) =>{
    console.log("client nfc_connect " + socket.id );

    let nfc_connect_state = 'fail';
    let token = undefined;
    
    // Same nfc_connect
    if(clients.has(socket.id) || 
        typeof message.app_id === undefined || 
        typeof message.device_type === undefined){
      nfc_connect_state = 'fail'
    }else{
      // Create a new client info
      let client = null;

      if(message.device_type === 'cable_right' && nfc_booking_state[message.device_type] === false){
        console.log("Create a new cable client")
        // refresh booking state
        nfc_booking_state[message.device_type] = true;

        // create a new cable client
        client = new Cable(message.app_id);
        client.set_cable(50);
        
        cable_callback = setInterval( () => weight_callback(socket, client.cable_weight_queue), 1000);
        client.callback = cable_callback;
        clients.set(socket.id, client);

      }else if(message.device_type === 'dumbbell' && nfc_booking_state[message.device_type] === false){

        // refresh booking state
        nfc_booking_state[message.device_type] = true;

        // create a new dumbbell client
        client = new Dumbbell(message.app_id);

        // set a dumbbell_callback to client
        dumbbell_callback = setInterval( () => weight_callback(socket, client.dumbell_weight_queue), 1000);
        client.callback = dumbbell_callback;
        clients.set(socket.id, client);

      }else if(message.device_type === 'barbell' && nfc_booking_state[message.device_type] === false){

        // refresh booking state
        nfc_booking_state[message.device_type] = true;

        // create a new barbell client
        client = new Barbell(message.app_id)

        // set a barbell_callback to client
        barbell_callback = setInterval( () => weight_callback(socket, client._barbell_weight_queue), 1000);
        client.callback = barbell_callback;
        clients.set(socket.id, client);
      
      }
      
      let limit = 60 * 100;
      let expires = Math.floor(Date.now() / 1000) + limit;
      let playload = {
          app_id : message.app_id,
          device_type : message.device_type,
          exp : expires
      }
      token = jwt.sign(playload, process.env.JWT_KEY);

      nfc_connect_state = 'success'
    }

    socket.emit('ack_nfc_connect',{state : nfc_connect_state, token: token, playload:message});

  });

  // - NFC Disconnect
  socket.on('nfc_disconnect', (message) =>{
    console.log("client nfc_disconnect " + socket.id);

    const tokenAuth = auth(message.token); 

    let nfc_disconnect_state = 'fail';
    let client = clients.get(socket.id);

    if(tokenAuth === true  && client !== undefined){

      switch(client.constructor){
        case Dumbbell:
          nfc_booking_state['dumbbell'] = false;
          break;
        case Barbell:
          nfc_booking_state['barbell'] = false;
          break;
        case Cable:
          nfc_booking_state['cable_right'] = false;
          break;
      }

      clearInterval(client.callback)
      clients.delete(socket.id);
      nfc_disconnect_state = 'success'
    }
    socket.emit("ack_nfc_disconnect", {state: nfc_disconnect_state, auth:tokenAuth, playload:message});
    
  });

  // - Select Type
  socket.on('work_select', message =>{
    console.log("client work_select " + socket.id);

    const tokenAuth = auth(message.token);
    
    let work_select_state = 'fail';
    const client = clients.get(socket.id);
    
    if(tokenAuth === true && client !== undefined && client.current_state == process.env.SELECTING_WORKOUT){

      
      switch(client.constructor){
        case Dumbbell:

          if(!work_type_list['dumbbell'].includes(message.work_type))
            break;
          client.current_state = process.env.SENSING;
          client.work_type = message.work_type;
          setTimeout(() => socket.emit("dumbbell_weight", {'weight':[6,6]}), 3000);
          work_select_state = 'success';
          break;
        case Barbell:
          if(!work_type_list['barbell'].includes(message.work_type))
            break;
          client.current_state = process.env.WAIT_SENSING;
          client.work_type = message.work_type;
          work_select_state = 'success';

          break;
        case Cable:
          console.log('work type change in cable');
          if(!work_type_list['cable_right'].includes(message.work_type))
            break;
          client.current_state = process.env.SENSING;
          client.work_type = message.work_type;
          work_select_state = 'success';
          break;
      }
    }

    socket.emit("ack_work_select", {state: work_select_state, auth:tokenAuth, playload:message});

  });
  
  socket.on('barbell_weight_complete', (message) =>{
    console.log("barbell_weight_complete" + socket.id);
    let barbell_weight_complete_state = 'fail';
    const tokenAuth = auth(message.token); 
    const client = clients.get(socket.id);

    if(tokenAuth === true && client !== undefined && client instanceof Barbell && client.current_state == process.env.WAIT_SENSING){
      client.weight = 60;
      client.current_state = process.env.SENSING;
      setTimeout(() => socket.emit("barbell_weight", {'weight':client.weight}), 3000);

      barbell_weight_complete_state = 'success'
    }

    socket.emit("ack_barbell_weight_complete", {state:barbell_weight_complete_state, auth:tokenAuth, playload:message});
  });

  // - Start training
  socket.on('start_training', (message) =>{
    console.log("client start_training " + socket.id + " , " + JSON.stringify(message,null, " "));

    const tokenAuth = auth(message.token); 

    let start_training_state = 'fail';
    const client = clients.get(socket.id);

    if(tokenAuth === true && client !== undefined && client.current_state == process.env.SENSING){

      // Change client state

      switch(client.constructor){
        case Dumbbell:
          client.current_state = process.env.TRAINING;
          client.weight = 16;
          break;
        case Barbell:
          client.current_state = process.env.TRAINING;
          
          break;
        case Cable:
          client.current_state = process.env.TRAINING;
          client.weight = 40;
          break;
      }

      start_training_state = 'success';

    }

    //Send ACK
    socket.emit("ack_start_training", {state:start_training_state, auth:tokenAuth, playload:message});

  });

  // - Stop training
  socket.on('stop_training', (message) =>{
    console.log("client stop_training " + socket.id + " , " + JSON.stringify(message,null, " "));

    const tokenAuth = auth(message.token); 

    let stop_training_state = 'fail';
    const client = clients.get(socket.id);

    if(tokenAuth === true  && client !== undefined && client.current_state == process.env.TRAINING){

      if(message.action == 'stop'){

        switch(client.constructor){
          case Dumbbell:
            client.training_process = {'times': 8, 'training_time':  Math.floor(Math.random() * 100), 'rest_time':30}
            break;
          case Barbell:
            client.training_process = {'times': 10, 'training_time': Math.floor(Math.random() * 100), 'rest_time':12}
            break;
          case Cable:
            client.training_process = {'times': 12, 'training_time': Math.floor(Math.random() * 100), 'rest_time':40}
            break;
        }

        client.current_state = process.env.RESULT;

        
        setTimeout( () => socket.emit("training_result", client.training_result, 3000))
        
        stop_training_state = 'success';
      }else if(message.action == 'return'){

        client.current_state = process.env.SELECTING_WORKOUT;
        client.reset();
        stop_training_state = 'success';
      }

    }

    // Send ACK
    socket.emit("ack_stop_training", {state: stop_training_state, auth:tokenAuth, playload:message});

  });

  // - ACK Training result
  socket.on('ack_training_result', (message) =>{
    console.log("client ack_training_result " + socket.id + " , " + JSON.stringify(message,null, " "));
    const tokenAuth = auth(message.token); 

    const client = clients.get(socket.id);

    if(tokenAuth === true){

      if(message.again == 'yes'){
        client.current_state = process.env.TRAINING;
        client.reset_last_training_result()
      }else if(message.again == 'no'){
        client.current_state = process.env.SELECTING_WORKOUT;
        client.reset();
      }
    }
  });

  // - ACK Barbell weight
  socket.on('ack_barbell_weight', (message) =>{
    console.log("client ack_barbell_weight " + socket.id + " , " + JSON.stringify(message,null, " "));

    const tokenAuth = auth(message.token);
  });

  // - ACK Dumbbell weight
  socket.on('ack_dumbbell_weight', (message) =>{
    console.log("client ack_dumbbell_weight " + socket.id + " , " + JSON.stringify(message,null, " "));

    const tokenAuth = auth(message.token); 
  });

})


const weight_callback = (socket, weight_queue) =>{

  // console.log(socket.id);
  if(weight_queue.length > 0){

    const client = clients.get(socket.id)

    if(client instanceof Dumbbell)
      socket.emit('dumbbell_weight',weight_queue.shift());
    else if(client instanceof Barbell)
      socket.emit('barbell_weight', weight_queue.shift());
    else if(client instanceof Cable)
      socket.emit('cable_weight', weight_queue.shift());
    
  }
}


server.listen(port, () => console.log(`Listening on port ${port}`));
// deviceServer.listen(deviceServerPort, () => console.log(`Listening on port ${deviceServerPort}`));