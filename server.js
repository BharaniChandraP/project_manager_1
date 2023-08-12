if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
  }
  //process.env holds various environmental variables for the current process
  // const fs = require('fs');
  const express = require('express')
  const keys = require('./keys'); 
  const app = express()
  const bcrypt = require('bcrypt')
  const passport = require('passport')
  const flash = require('express-flash')
  const session = require('express-session')
  const cookieSession=require('cookie-session')
  const methodOverride = require('method-override')
  const User = require('./models/users')
  const Project = require('./models/projects');
   const mongoose = require('mongoose');
  const initializePassport = require('./passport-config')
  initializePassport(
    passport,
    email => User.findOne({email: email}),
    id => User.findById(id)
  )
  // const dayjs = require('dayjs');
  const bodyParser = require('body-parser');



  app.set('view-engine', 'ejs')
  app.use(express.urlencoded({ extended: false }))
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(flash())
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  }))
  app.use(passport.initialize())
  app.use(passport.session())
  app.use(methodOverride('_method'))
  const sessionConfig = {
    secret: 'thisshouldbeabettersecret!',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, 
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
  }
  app.use(session(sessionConfig))
  // app.use('/uploads', express.static('uploads'));
  app.get('/', checkAuthenticated, (req, res) => {
    res.render('home.ejs', { name: req.user.name })
  })



  app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render('login.ejs')
  })
  
  app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
  }))
  
  app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render('register.ejs')
  })
  
  app.post('/register', checkNotAuthenticated, async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
            const user = new User({
                name: req.body.name,
                email: req.body.email,
                password: hashedPassword
                });
                await user.save();
                console.log(user);
                res.redirect('/login');
      
    } catch(error){
        console.log(error);
      res.redirect('/register')
    }
  })
  
  
  function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
  
    res.redirect('/login')
  }
  
  function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect('/')
    }
    next()
  }

  app.get('/dashboard', checkAuthenticated, async (req, res) => {
    try {
        const loggedInUser = req.user;
        const ownedProjects = await Project.find({ teamLeader: loggedInUser._id });
        const memberProjects = await Project.find({ teamMembers: loggedInUser._id });

        res.render('dashboard.ejs', { user: loggedInUser, ownedProjects, memberProjects });
    } catch (error) {
        console.log(error);
        res.redirect('/login'); // Handle the error appropriately
    }
});



  app.get('/search-users', checkAuthenticated, async (req, res) => {
    const searchQuery = req.query.q;
    try {
        const users = await User.find({ name: { $regex: searchQuery, $options: 'i' } });
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while searching for users.' });
    }
});
  app.get('/create-project', checkAuthenticated, (req, res) => {
    res.render('create-project.ejs');
  });
app.post('/create-project', checkAuthenticated, async (req, res) => {
  try {
      const { name, description, selectedMembers } = req.body;

      const newProject = new Project({
          name,
          description,
          teamLeader:  req.user._id,
          teamMembers: [req.user._id, ...JSON.parse(selectedMembers)],
      });

      await newProject.save();

      // Use $push to add the newProject's _id to the user's projects array
      await User.updateOne(
          { _id: req.user._id },
          { $push: { projects: newProject._id } }
      );

      res.redirect('/dashboard');
  } catch (error) {
      console.log(error);
      res.redirect('/create-project');
  }
});

  app.get('/add-member/:projectId', checkAuthenticated, async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const project = await Project.findById(projectId).populate('teamMembers');
      res.render('add-member.ejs', { projectId, project });
    } catch (error) {
      console.log(error);
      res.redirect('/dashboard'); // Handle the error appropriately
    }
  });
  
  


app.post('/add-member/:projectId', checkAuthenticated, async (req, res) => {
  try {
      const projectId = req.params.projectId;
      const { searchUser, selectedMembers } = req.body;

      const user = await User.findOne({ name: searchUser });

      if (!user) {
          return res.redirect(`/add-member/${projectId}`);
      }

      // const project = await Project.findById(projectId);
      const project = await Project.findById(projectId).populate('teamMembers');


      if (!project) {
          return res.redirect('/dashboard');
      }

      if (!project.teamMembers) {
          project.teamMembers = [];
      }

      // Parse the JSON string and filter out any invalid values
      const validMembers = JSON.parse(selectedMembers).filter(id => mongoose.Types.ObjectId.isValid(id));

      // Add the new members to the existing project's teamMembers array
      project.teamMembers.push(...validMembers);

      await project.save();

      res.redirect(`/add-member/${projectId}`);
  } catch (error) {
      console.log(error);
      res.redirect('/dashboard'); // Handle the error appropriately
  }
});
app.get('/projects/:projectId', checkAuthenticated, async (req, res) => {
  try {
      const loggedInUser = req.user;
      const projectId = req.params.projectId;

      // Fetch the project details using the projectId
      const project = await Project.findById(projectId);

      if (!project) {
          return res.status(404).render('error.ejs', { message: 'Project not found' });
      }
      const isOwner = project.teamLeader.equals(loggedInUser._id);

      res.render('project-details.ejs', { user: loggedInUser, project, isOwner });
      // res.render('project-details.ejs', { user: loggedInUser, project });
  } catch (error) {
      console.log(error);
      res.redirect('/dashboard'); // Handle the error appropriately
  }
});

app.get('/projects/:projectId/edit', checkAuthenticated, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const projectId = req.params.projectId;

    // Fetch the project details using the projectId
    const project = await Project.findById(projectId);

    if (!project) {
      // return res.status(404).render('error.ejs', { message: 'Project not found' });
      return res.send("error !")
    }

    // Check if the logged-in user is the owner of the project
    if (!project.teamLeader.equals(loggedInUser._id)) {
      return res.redirect(`/projects/${projectId}`);
    }

    res.render('edit-project.ejs', { user: loggedInUser, project });
  } catch (error) {
    console.log(error);
    res.redirect(`/projects/${projectId}`); // Handle the error appropriately
  }
});
app.post('/projects/:projectId/update', checkAuthenticated, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const projectId = req.params.projectId;
    const { name, description /* other fields */ } = req.body;

    // Fetch the project details using the projectId
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).render('error.ejs', { message: 'Project not found' });
    }

    // Check if the logged-in user is the owner of the project
    if (!project.teamLeader.equals(loggedInUser._id)) {
      return res.redirect(`/projects/${projectId}`);
    }

    // Update the project details
    project.name = name;
    project.description = description;
    // Update other fields as needed

    await project.save();

    res.redirect(`/projects/${projectId}`);
  } catch (error) {
    console.log(error);
    res.redirect(`/projects/${projectId}`); // Handle the error appropriately
  }
});


app.get('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});


  function connectDB() {
    const dbURI = 'mongodb+srv://beingmyself1104:aknAwok0GSOEFzif@cluster0.g7qy6xw.mongodb.net/?retryWrites=true&w=majority';
  
    mongoose.connect(dbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    .then(() => {
      console.log('MongoDB Connected...');
      startServer();
    })
    .catch(err => {
      console.error('Failed to connect to MongoDB:', err);
    });
  }
  // Check if already connected to MongoDB Atlas
  if (mongoose.connection.readyState === 1) {
      // Already connected, start the server
      startServer();
    } else {
      // Not connected, establish connection and then start the server
      connectDB();
    }
    

const PORT = process.env.NODE_ENV || 5000;
function startServer() {
        app.listen(PORT, () => {
          console.log('Server started on port 5000');
        });
      }