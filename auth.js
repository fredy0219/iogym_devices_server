const jwt = require("jsonwebtoken");

const verifyToken = (token) =>{

    if(typeof token === undefined){
        return false;
    }

    try{
        const playload = jwt.verify(token, process.env.JWT_KEY)
        return true;
    }catch(err){
        console.log('Invaild token');
        return err;
        
    }
};

module.exports = verifyToken;