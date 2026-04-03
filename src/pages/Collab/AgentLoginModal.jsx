/**
 * AgentLoginModal — Login dialog for agent registration
 *
 * Flow:
 * 1. Register agent on collab plane
 * 2. Send initial heartbeat
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';
import { z } from 'zod';

import './AgentLoginModal.css';

const VALID_ROLES = ['ui', 'backend', 'qa'];

const AgentLoginSchema = z.object({
    agentId: z.string().min(1, 'Agent ID is required'),
    name: z.string().min(1, 'Display name is required'),
    role: z.enum(['ui', 'backend', 'qa']),
    capabilities: z.string().optional(),
});

const ROLE_OPTIONS = [
    { value: 'ui', label: 'UI / Visual', description: 'Frontend, CSS, JSX, accessibility' },
    { value: 'backend', label: 'Backend / Logic', description: 'Engine, schemas, runtime' },
    { value: 'qa', label: 'Testing / QA', description: 'Tests, CI, debugging' },
];

export default function AgentLoginModal({ isOpen, onClose, onSuccess }) {
    const [step, setStep] = useState('form'); // 'form' | 'registering' | 'success' | 'error'
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        agentId: '',
        name: '',
        role: 'backend',
        capabilities: '',
    });

    const updateField = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    }, []);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError(null);

        // Validate
        const parsed = AgentLoginSchema.safeParse(formData);
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message || 'Validation failed');
            return;
        }

        if (!VALID_ROLES.includes(formData.role)) {
            setError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
            return;
        }

        setStep('registering');

        try {
            // Step 1: Register agent
            const capabilities = formData.capabilities
                ? formData.capabilities.split(',').map(s => s.trim()).filter(Boolean)
                : [];

            const registerResponse = await fetch('/collab/agents/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: formData.agentId,
                    name: formData.name,
                    role: formData.role,
                    capabilities,
                }),
            });

            if (!registerResponse.ok) {
                const errData = await registerResponse.json();
                throw new Error(errData.error || errData.details?.join(', ') || 'Registration failed');
            }

            const agent = await registerResponse.json();

            // Step 2: Send initial heartbeat
            await fetch(`/collab/agents/${formData.agentId}/heartbeat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'online',
                    current_task_id: null,
                }),
            });

            setStep('success');

            // Notify parent and close after brief delay
            setTimeout(() => {
                onSuccess?.(agent);
                onClose();
                setStep('form');
                setFormData({
                    agentId: '',
                    name: '',
                    role: 'backend',
                    capabilities: '',
                });
            }, 1500);
        } catch (err) {
            setError(err.message || 'An unexpected error occurred');
            setStep('form');
        }
    }, [formData, onClose, onSuccess]);

    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget && step !== 'registering') {
            onClose();
        }
    }, [onClose, step]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="agent-login-modal__backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleBackdropClick}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="agent-login-modal-title"
                >
                    <motion.div
                        className="agent-login-modal"
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <header className="agent-login-modal__header">
                            <h3 id="agent-login-modal-title" className="agent-login-modal__title">
                                {step === 'success' ? 'Agent Connected' : 'Log In Agent'}
                            </h3>
                            {step !== 'logging-in' && step !== 'registering' && step !== 'success' && (
                                <button
                                    className="agent-login-modal__close"
                                    onClick={onClose}
                                    aria-label="Close modal"
                                >
                                    ×
                                </button>
                            )}
                        </header>

                        <div className="agent-login-modal__body">
                            {step === 'form' && (
                                <form onSubmit={handleSubmit} className="agent-login-form">
                                    <div className="agent-login-form__group">
                                        <label htmlFor="agent-id" className="agent-login-form__label">
                                            Agent ID
                                        </label>
                                        <input
                                            id="agent-id"
                                            type="text"
                                            className="agent-login-form__input"
                                            value={formData.agentId}
                                            onChange={(e) => updateField('agentId', e.target.value)}
                                            placeholder="e.g., qwen-code, claude-ui"
                                            required
                                            autoComplete="off"
                                        />
                                        <span className="agent-login-form__help">
                                            Unique identifier for this agent instance
                                        </span>
                                    </div>

                                    <div className="agent-login-form__group">
                                        <label htmlFor="agent-name" className="agent-login-form__label">
                                            Display Name
                                        </label>
                                        <input
                                            id="agent-name"
                                            type="text"
                                            className="agent-login-form__input"
                                            value={formData.name}
                                            onChange={(e) => updateField('name', e.target.value)}
                                            placeholder="e.g., Qwen Code, Claude UI"
                                            required
                                            autoComplete="off"
                                        />
                                    </div>

                                    <div className="agent-login-form__group">
                                        <span className="agent-login-form__label">Role</span>
                                        <div className="agent-login-form__roles">
                                            {ROLE_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    className={`agent-login-form__role-btn ${formData.role === opt.value ? 'selected' : ''}`}
                                                    onClick={() => updateField('role', opt.value)}
                                                    aria-pressed={formData.role === opt.value}
                                                >
                                                    <span className="agent-login-form__role-label">{opt.label}</span>
                                                    <span className="agent-login-form__role-desc">{opt.description}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="agent-login-form__group">
                                        <label htmlFor="capabilities" className="agent-login-form__label">
                                            Capabilities <span className="agent-login-form__optional">(optional)</span>
                                        </label>
                                        <input
                                            id="capabilities"
                                            type="text"
                                            className="agent-login-form__input"
                                            value={formData.capabilities}
                                            onChange={(e) => updateField('capabilities', e.target.value)}
                                            placeholder="e.g., jsx,css,analysis or node,fastify,schemas"
                                            autoComplete="off"
                                        />
                                        <span className="agent-login-form__help">
                                            Comma-separated list of agent capabilities
                                        </span>
                                    </div>

                                    {error && (
                                        <div className="agent-login-form__error" role="alert">
                                            {error}
                                        </div>
                                    )}

                                    <div className="agent-login-form__actions">
                                        <button
                                            type="button"
                                            className="agent-login-form__btn agent-login-form__btn--cancel"
                                            onClick={onClose}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="agent-login-form__btn agent-login-form__btn--primary"
                                        >
                                            Connect Agent
                                        </button>
                                    </div>
                                </form>
                            )}

                            {step === 'registering' && (
                                <div className="agent-login-modal__loading">
                                    <div className="agent-login-modal__spinner" />
                                    <p className="agent-login-modal__loading-text">Registering agent on collab plane...</p>
                                </div>
                            )}

                            {step === 'success' && (
                                <div className="agent-login-modal__success">
                                    <div className="agent-login-modal__success-icon">✓</div>
                                    <p className="agent-login-modal__success-text">Agent connected successfully</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
