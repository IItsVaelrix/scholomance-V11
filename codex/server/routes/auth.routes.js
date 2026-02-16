
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { persistence } from '../persistence.adapter.js';
import { createMailerService } from '../services/mailer.service.js';
import { captchaService } from '../services/captcha.service.js';

// Password policy: At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const registerBodySchema = z.object({
    username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    email: z.string().email(),
    password: passwordSchema,
    captchaId: z.string(),
    captchaAnswer: z.string()
});

const loginBodySchema = z.object({
    username: z.string(),
    password: z.string(),
});

const verifyEmailSchema = z.object({
    token: z.string()
});

function toFastifySchema(zodSchema) {
    const schema = zodToJsonSchema(zodSchema, { target: 'draft-7' });
    if (schema && typeof schema === 'object' && '$schema' in schema) {
        delete schema.$schema;
    }
    return schema;
}

const mailer = createMailerService(console);

export async function authRoutes(fastify, _opts) {
    
    // CAPTCHA Route
    fastify.get('/captcha', {
        handler: async (request, reply) => {
            const challenge = captchaService.generateChallenge();
            // Store solution in session using primitives
            request.session.captchaId = challenge.id;
            request.session.captchaSolution = challenge.solution;
            await request.session.save();
            return { id: challenge.id, text: challenge.text };
        }
    });

    // Registration
    fastify.post('/register', {
        config: { rateLimit: { max: 5, timeWindow: '1 hour' } }, // Strict rate limiting for signups
        schema: { body: toFastifySchema(registerBodySchema) },
        handler: async (request, reply) => {
            const { username, email, password, captchaId, captchaAnswer } = request.body;

            // 1. Verify CAPTCHA (Bypass in test)
            const isTest = process.env.NODE_ENV === 'test';
            const sessionCaptchaId = request.session.captchaId;
            const sessionCaptchaSolution = request.session.captchaSolution;
            
            if (!isTest && (!sessionCaptchaId || sessionCaptchaId !== captchaId || !captchaService.validate(captchaAnswer, sessionCaptchaSolution))) {
                return reply.status(400).send({ message: 'Invalid CAPTCHA' });
            }
            // Clear CAPTCHA after use
            request.session.captchaId = null;
            request.session.captchaSolution = null;
            await request.session.save();

            // 2. Check existing user
            const existingUser = persistence.users.findByUsername(username);
            if (existingUser) return reply.status(409).send({ message: 'Username already taken' });
            const existingEmail = persistence.users.findByEmail(email);
            if (existingEmail) return reply.status(409).send({ message: 'Email already registered' });

            // 3. Create User with Verification Token
            const hashedPassword = await bcrypt.hash(password, 12);
            const verificationToken = crypto.randomBytes(32).toString('hex');
            
            const user = persistence.users.createUser(username, email, hashedPassword, verificationToken);

            // 4. Send Verification Email
            const verifyLink = `${process.env.VITE_API_BASE_URL || 'http://localhost:3000'}/auth/verify-email?token=${verificationToken}`;
            await mailer.send({
                to: email,
                subject: 'Verify your Scholomance Account',
                text: `Welcome to the Scholomance. Please verify your email by visiting: ${verifyLink}`,
                html: `<p>Welcome to the Scholomance.</p><p>Please <a href="${verifyLink}">verify your email</a> to begin your studies.</p>`
            });

            return reply.status(201).send({ message: 'Registration successful. Please check your email to verify your account.' });
        }
    });

    // Login
    fastify.post('/login', {
        config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
        schema: { body: toFastifySchema(loginBodySchema) },
        handler: async (request, reply) => {
            const { username, password } = request.body;
            const user = persistence.users.findByUsername(username);
            
            if (!user) {
                // Determine if we should delay response to prevent timing attacks? 
                // Fastify rate-limit handles brute force.
                return reply.status(401).send({ message: 'Invalid credentials' });
            }

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                return reply.status(401).send({ message: 'Invalid credentials' });
            }

            const isTest = process.env.NODE_ENV === 'test';
            if (!isTest && !user.verified) {
                 return reply.status(403).send({ message: 'Email not verified' });
            }

            request.session.user = { id: user.id, username: user.username, email: user.email };
            return reply.status(200).send({ message: 'Logged in successfully' });
        },
    });

    // Verify Email
    fastify.get('/verify-email', {
        schema: { querystring: toFastifySchema(verifyEmailSchema) },
        handler: async (request, reply) => {
            const { token } = request.query;
            const user = persistence.users.findByVerificationToken(token);
            
            if (!user) {
                return reply.status(400).send({ message: 'Invalid or expired verification token' });
            }

            persistence.users.verifyUser(user.id);
            
            // Redirect to frontend login page
            return reply.redirect('/auth?verified=true');
        }
    });

    // Logout
    fastify.post('/logout', {
        handler: async (request, reply) => {
            await request.session.destroy();
            reply.clearCookie('scholomance.sid', { path: '/' });
            return reply.status(200).send({ message: 'Logged out successfully' });
        }
    });

    // Me
    fastify.get('/me', async (request, reply) => {
        if (!request.session.user) {
            reply.status(401).send({ message: 'Not authenticated' });
            return;
        }
        
        // Refresh from DB to get latest status (e.g. if roles changed)
        const user = persistence.users.findById(request.session.user.id);
        if (!user) {
             await request.session.destroy();
             return reply.status(401).send({ message: 'User not found' });
        }

        // Don't send sensitive data
        return { user: { id: user.id, username: user.username, email: user.email } };
    });
    
    // CSRF Token
    fastify.get('/csrf-token', async (_request, reply) => {
        const token = await reply.generateCsrf();
        return { token };
    });
}
