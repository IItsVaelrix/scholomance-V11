import { persistence } from "./persistence.adapter.js";

const DEV_GUEST_USERNAME = "test";
export const LEXICON_GUEST_SESSION_KEY = 'lexiconGuest';
const ENABLE_DEV_AUTH =
    process.env.ENABLE_DEV_AUTH === "true" &&
    process.env.NODE_ENV === "development";

export const requireAuth = async (request, reply) => {
    const session = request.session;
    if (session?.user) {
        return;
    }

    if (ENABLE_DEV_AUTH) {
        console.warn("[AUTH] Development auth bypass enabled - NOT FOR PRODUCTION");
        const devUser = persistence.users.findByUsername(DEV_GUEST_USERNAME);
        if (devUser && session) {
            session.user = {
                id: devUser.id,
                username: devUser.username,
                email: devUser.email,
                guest: true,
                isDevelopmentBypass: true,
            };
            return;
        }
    }

    request.server?.opsMetrics?.increment?.('authFailures');
    return reply.status(401).send({ message: 'Unauthorized: Please log in.' });
};

export const requireLexiconSession = async (request, reply) => {
    const session = request.session;
    if (session?.user) {
        return;
    }

    if (session?.[LEXICON_GUEST_SESSION_KEY] === true) {
        return;
    }

    request.server?.opsMetrics?.increment?.('authFailures');
    return reply.status(401).send({ message: 'Unauthorized: Session required.' });
};
