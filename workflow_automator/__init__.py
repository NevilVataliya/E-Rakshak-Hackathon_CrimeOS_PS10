"""
Workflow Automator Agent Package for CrimeOS / E-Rakshak.
Master Orchestrator, Template Engine, SMTP Mailer (smtplib), Analytics Agent, and Inbox Monitor Agent for Law Enforcement Investigations.
"""

from .template_engine import TemplateEngine, EmailCategory, EmailTemplate
from .smtp_mailer import SMTPMailer
from .analytics_agent import AnalyticsAgent
from .inbox_monitor import InboxMonitorAgent
from .automator_agent import MasterWorkflowAutomatorAgent

__all__ = [
    "TemplateEngine",
    "EmailCategory",
    "EmailTemplate",
    "SMTPMailer",
    "AnalyticsAgent",
    "InboxMonitorAgent",
    "MasterWorkflowAutomatorAgent"
]
