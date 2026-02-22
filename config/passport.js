import LocalStrategy from 'passport-local';
import User from '../models/User.js';

export default function(passport) {
  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        try {
          // Find user by email
          const user = await User.findOne({ email: email.toLowerCase() });
          
          if (!user) {
            return done(null, false, { message: 'Email not registered' });
          }

          // Compare password
          const isMatch = await user.comparePassword(password);
          
          if (!isMatch) {
            return done(null, false, { message: 'Password incorrect' });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // Serialize user to store in session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
}
