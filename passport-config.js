// const { authenticate } = require('passport')

// const LocalStrategy = require('passport-local').Strategy
// const bcrypt = require('bcrypt')

// function initialize(passport){
//     const authenticateUser =async(email,password,done)=>{
//         const user=getUserByEmail(email)
//         if(user==null){
//             return done(null,false,{message:'No user with that email'})
//         }
//         try{
//             if( await bcrypt.compare(password,user.password)){
//                 return done(null,user)
//             }
//             else{
//                 return done(null,false,{message:'Password incorrect'})
//             }
//         }
//         catch(e){
//             return done(e)
//         }
//     }
//     passport.use(new LocalStrategy({usernameField:'email'}),authenticateUser)
//     passport.serializeUser((user,done)=>{})
//     passport.deserializeUser((id,done)=>{})

// }
// module.exports=initialize


// const LocalStrategy = require('passport-local').Strategy
// const bcrypt = require('bcrypt')
// const User = require('./models/user')

// // function initialize(passport, getUserByEmail, getUserById) {
// // //   const authenticateUser = async (email, password, done) => {
// // //     const user = getUserByEmail(email)
// // //     if (user == null) {
// // //       return done(null, false, { message: 'No user with that email' })
// // //     }

// // //     try {
// // //       if (await bcrypt.compare(password, user.password)) {
// // //         return done(null, user)
// // //       } else {
// // //         return done(null, false, { message: 'Password incorrect' })
// // //       }
// // //     } catch (e) {
// // //       return done(e)
// // //     }
// // //   }


//   passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser))
//   passport.serializeUser((user, done) => done(null, user.id))
//   passport.deserializeUser((id, done) => {
//     return done(null, getUserById(id))
//   })
// }

// module.exports = initialize


const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const User = require('./models/users');

function initialize(passport) {
  const authenticateUser = async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email });

      if (!user) {
        return done(null, false, { message: 'Incorrect email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return done(null, false, { message: 'Incorrect email or password.' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  };

  passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

module.exports = initialize;



