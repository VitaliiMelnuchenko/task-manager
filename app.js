var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    methorOverride = require('method-override'),
    passport = require('passport'),
    LocalStrategy = require('passport-local'),
    passportLocalMongoose = require('passport-local-mongoose')

//APP CONFIG
mongoose.connect('mongodb://localhost/task_manager', { useNewUrlParser: true });
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'ejs');
app.use(methorOverride('_method'));

//MONGOOSE MODELS
var taskSchema = new mongoose.Schema({
    task_content: String,
    priority: Number,
    deadline: String,
    author: String,
    description: String,
    isFinished: {type: Boolean, default: false}
});
var Task = mongoose.model('Task', taskSchema);

var userSchema = new mongoose.Schema({
    username: String,
    password: String,
    list: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task'
        }
    ]
});
userSchema.plugin(passportLocalMongoose);
var User = mongoose.model('User', userSchema);

//PASSPORT CONFIG
app.use(require('express-session')({
    secret: 'anything',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next) {
    res.locals.curentUser = req.user;
    next();
})

//=================================================
//ROUTES
//=================================================
app.get('/', function(req, res) {
    res.redirect('/task');
})

app.get('/task', function(req, res) {
    if (req.user) {
        User.findById(req.user._id).populate('list').exec(function(err, user) {
            if (err) {
                console.log(err);
                res.render('index', {tasks: []})
            } else {
                res.render('index', {tasks: user.list})
            }
        });
    } else {
        res.render('index', {tasks: []});
    }
});

app.get('/task/new', isLoggedIn, function(req, res) {
    res.render('create');
});

app.post('/task', isLoggedIn, function(req, res) {
    var taskObj = req.body.task;
    taskObj['author'] = req.user.username;
    taskObj['deadline'] = `${req.body.hour}:${req.body.minute}  ${req.body.day}/${req.body.month}/${req. body.year}`;
    Task.create(taskObj, function(err, task) {
        User.findById(req.user._id, function(err, foundUser) {
            if (err) {
                console.log(err);
            } else {
                foundUser.list.push(task);
                foundUser.save(function(err, data) {
                    if (err) {
                        console.log(err);
                    } else {
                        res.redirect('/task');
                    }
                });
            }
        });
    });
});

app.get('/task/:id', checkTaskOwnership, function(req, res) {
    Task.findById(req.params.id, function(err, foundTask) {
        if (err) {
            console.log(err);
        } else {
            res.render('show', {task: foundTask});
        }
    });
});

app.get('/task/:id/edit', checkTaskOwnership, function(req, res) {
    Task.findById(req.params.id, function(err, foundTask){
        if(err) {
            console.log(err);
        } else {
            res.render('edit', {task: foundTask});
        }
    });
});

app.put('/task/:id', checkTaskOwnership, function(req, res) {
    req.body.task['deadline'] = `${req.body.hour}:${req.body.minute}  ${req.body.day}/${req.body.month}/${req. body.year}`;
    Task.findByIdAndUpdate(req.params.id, {$set: req.body.task}, function(err, updatedTask) {
        if (err) {
            console.log(err);
        } else {
            res.redirect(`/task/${req.params.id}`);
        }
    });
});

app.post('/finished/:id', function(req, res) {
    Task.findById(req.params.id, function(err, foundTask) {
        if (err) {
            console.log(err);
            res.redirect(`/task`);
        } else {
            Task.findByIdAndUpdate(req.params.id, {$set: {isFinished: !foundTask.isFinished}}, function(err, updatedTask) {
                if (err) {
                    console.log(err);
                } else {
                    res.redirect(`/task`);
                }
            });
        }
    });
})

app.delete('/task/:id', checkTaskOwnership, function(req, res) {
    Task.findById(req.params.id, function(err, foundTask) {
        if (err) {
            console.log(err);
        } else {
            if (req.user.username === foundTask.author) {
                Task.findByIdAndDelete(req.params.id, function(err, deletedTask) {
                    if (err) {
                        console.log(err);
                    } else {
                        res.redirect('/task');
                    }
                });
            } else {
                User.findById(req.user._id, function(err, foundUser) {
                    foundUser.list = removeByValue(foundUser.list, `${foundTask._id}`);
                    foundUser.save(function(err, data) {
                        if (err) {
                            console.log(err);
                        } else {
                            res.redirect('/task');
                        }
                    });
                });
            }
        }
    });

    function removeByValue(arr, value) {
        for(let i = 0; i < arr.length; i++) {
            if((arguments.length > 1 && arr[i] == value )) { 
                arr.splice(i,1);
            }
        }
        return arr;
    }
});

app.post('/share/:id', checkTaskOwnership, function(req, res) {
    User.findOne({'username': req.body.username}, function(err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            Task.findById(req.params.id, function(err, foundTask) {
                if (err) {
                    console.log(err);
                } else {
                    foundUser.list.push(foundTask);
                    foundUser.save(function(err, data) {
                        if (err) {
                            console.log(err);
                        } else {
                            res.redirect('/task');
                        }
                    });
                }
            });
        }
    });
});

//================================
//AUTH ROUTES
//================================
app.get('/register', lockedLogin, function(req, res) {
    res.render('register');
});

app.post('/register', lockedLogin, function(req, res) {
    var newUser = new User({username: req.body.username});
    User.register(newUser, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            //res.redirect('/register');
            return res.render('register');
        } 
        passport.authenticate('local')(req, res, function(){
            res.redirect('/task');
        });
    });
});

app.get('/login', lockedLogin, function(req, res) {
    res.render('login');
});

app.post('/login', lockedLogin, passport.authenticate('local', 
    {
        successRedirect: '/task',
        failureRedirect: '/login'
    }),function(req, res) { 
});

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/task');
});

//MIDDLEWARE
function lockedLogin(req, res, next) {
    if(req.isAuthenticated()){
        res.redirect('/');
    } else {
        return next();
    }
}

function isLoggedIn(req, res, next) {
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect('/login');
}

function checkTaskOwnership(req, res, next) {
    if(req.isAuthenticated()){
        User.findById(req.user._id, function(err, foundUser) {
            if (foundUser.list.indexOf(req.params.id) !== -1) {
               next(); 
            } else {
                res.redirect('/task');
                console.log('you don\'t have permition to do that!');
            }
        });
    } else {
        res.redirect('/login');
    }
}

app.listen(3000, function() {
    console.log('server has been started!');
});