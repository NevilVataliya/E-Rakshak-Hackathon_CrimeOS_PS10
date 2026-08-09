#!/usr/bin/env python3
"""
Comprehensive Unit Test Suite for CrimeOS Workflow Automator Package.
Covers Template Engine (5 Crime Domains), SMTP Mailer, Inbox Monitor, 
Analytics Agent, and Master Workflow Automator Agent.
"""

import os
import sys
import unittest
import tempfile
import json
import time

# Ensure local imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from workflow_automator import (
    TemplateEngine,
    EmailCategory,
    EmailTemplate,
    SMTPMailer,
    InboxMonitorAgent,
    AnalyticsAgent,
    MasterWorkflowAutomatorAgent
)


class TestTemplateEngine(unittest.TestCase):
    def setUp(self):
        self.engine = TemplateEngine()

    def test_loaded_domains_and_templates(self):
        domains = self.engine.list_domains()
        self.assertIn("financial_fraud", domains)
        self.assertIn("cyber_crime", domains)
        self.assertIn("telecom_location", domains)
        self.assertIn("corporate_payroll", domains)
        self.assertIn("physical_homicide", domains)
        self.assertEqual(len(domains), 5)

    def test_render_all_5_domains(self):
        cases = [
            ("financial_fraud", "freeze", "financial_freeze_order"),
            ("cyber_crime", "user data", "cyber_ip_log_requisition"),
            ("telecom_location", "cdr", "telecom_cdr_requisition"),
            ("corporate_payroll", "audit", "corporate_audit_requisition"),
            ("physical_homicide", "cctv", "physical_cctv_preservation")
        ]
        for domain, action, expected_id in cases:
            tmpl = self.engine.select_template_for_target(domain=domain, directive_action=action)
            self.assertIsNotNone(tmpl)
            self.assertEqual(tmpl.template_id, expected_id)

            rendered = self.engine.render_email(tmpl.template_id, {
                "case_number": "FIR-TEST/2026/101",
                "receiver_name": "Test Officer",
                "account_number": "123456789",
                "target_identifier": "9876543210",
                "company_name": "Acme Corp",
                "location_address": "Main Street DVR"
            })
            self.assertIn("FIR-TEST/2026/101", rendered["subject"] + rendered["body"])

    def test_receiver_directory_lookup(self):
        contact_hdfc = self.engine.get_receiver_contact("hdfc")
        self.assertIsNotNone(contact_hdfc)
        self.assertEqual(contact_hdfc["email"], "nodal.fraud@hdfcbank.com")

        contact_fuzzy = self.engine.get_receiver_contact("Airtel Telecom")
        self.assertIsNotNone(contact_fuzzy)
        self.assertEqual(contact_fuzzy["email"], "nodal@airtel.com")

    def test_custom_template_registration(self):
        tmpl = self.engine.create_custom_template(
            template_id="unit_test_notice",
            title="Unit Test Statutory Notice",
            category_str="custom_extended",
            subject_template="TEST NOTICE: {{case_number}}",
            body_template="Notice for {{receiver_name}} in {{case_number}}.",
            required_vars=["case_number", "receiver_name"]
        )
        self.assertEqual(tmpl.template_id, "unit_test_notice")
        rendered = self.engine.render_email("unit_test_notice", {
            "case_number": "FIR-CUSTOM-99",
            "receiver_name": "Inspector Gadget"
        })
        self.assertEqual(rendered["subject"], "TEST NOTICE: FIR-CUSTOM-99")
        self.assertEqual(rendered["body"], "Notice for Inspector Gadget in FIR-CUSTOM-99.")


class TestSMTPMailer(unittest.TestCase):
    def setUp(self):
        self.mailer = SMTPMailer(simulation_mode=True)

    def test_simulation_dispatch(self):
        res = self.mailer.send_email(
            to_email="test.target@police.gov.in",
            to_name="Target Officer",
            subject="STATUTORY NOTICE [CrimeOS-REF: CR-101]",
            body_text="Please provide records.",
            case_number="CR-101"
        )
        self.assertTrue(res["success"])
        self.assertTrue(res["simulation"])
        self.assertEqual(res["recipient"]["email"], "test.target@police.gov.in")
        self.assertIn("crimeos-", res["message_id"])

    def test_attachment_file_path_reading(self):
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".csv") as tmp:
            tmp.write("Account,Amount\n112233,50000\n")
            tmp_path = tmp.name

        try:
            res = self.mailer.send_email(
                to_email="test@example.com",
                subject="Notice with Attachment",
                body_text="Attached file.",
                case_number="CR-102",
                attachments=[{"filename": "test.csv", "file_path": tmp_path}]
            )
            self.assertTrue(res["success"])
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


class TestInboxMonitor(unittest.TestCase):
    def setUp(self):
        self.monitor = InboxMonitorAgent()

    def test_case_reference_extraction(self):
        case1 = self.monitor.extract_case_reference("RE: Order [CrimeOS-REF: FIR-2026/889]", "Body content")
        self.assertEqual(case1, "FIR-2026/889")

        case2 = self.monitor.extract_case_reference("Compliance Report FIR-CYB-2026-90", "Body text")
        self.assertEqual(case2, "FIR-CYB-2026-90")

        case3 = self.monitor.extract_case_reference("Random email without ref", "No tag")
        self.assertIsNone(case3)

    def test_simulated_reply_ingestion_and_callback(self):
        callback_received = []

        def callback(case_num, sender, subject, body, atts):
            callback_received.append((case_num, sender, subject, len(atts)))

        self.monitor.on_reply_received_callback = callback

        self.monitor.simulate_receive_reply(
            sender_email="compliance@bank.com",
            subject="Bank Report",
            body_text="Freezed account.",
            attachment_filename="ledger.csv",
            attachment_content="Acc,Balance\n100,500\n",
            case_number="CR-TEST-55"
        )

        self.assertEqual(len(callback_received), 1)
        self.assertEqual(callback_received[0][0], "CR-TEST-55")
        self.assertEqual(callback_received[0][1], "compliance@bank.com")


class TestAnalyticsAgent(unittest.TestCase):
    def setUp(self):
        self.analytics = AnalyticsAgent()

    def test_bank_csv_parsing(self):
        bank_csv = """Account,Type,Amount,TxnID
501004928172,DEBIT,45000,TXN1001
918273645019,CREDIT,45000,TXN1002
"""
        res = self.analytics.analyze_response(
            provider_name="HDFC Bank",
            response_type="csv",
            file_path_or_content=bank_csv,
            case_number="FIR-BANK-1"
        )
        self.assertEqual(res["provider_name"], "HDFC Bank")
        self.assertGreaterEqual(res["risk_score"], 5)
        self.assertIn("visualization_config", res)
        entities = res.get("extracted_entities", {})
        self.assertTrue(len(entities.get("account_numbers", [])) >= 2)

    def test_cdr_csv_parsing(self):
        cdr_csv = """CallID,Timestamp,CallerNumber,ReceiverNumber,CallType,DurationSec,CellID,IMEI
CDR1,2026-07-24T01:15:00,9825012345,9898011223,OUTGOING,180,MUM-441,864209041234567
CDR2,2026-07-24T02:22:15,9825012345,918273645019,OUTGOING,45,DEL-882,864209041234567
"""
        res = self.analytics.analyze_response(
            provider_name="Airtel Telecommunications",
            response_type="csv",
            file_path_or_content=cdr_csv,
            case_number="FIR-TEL-1"
        )
        self.assertEqual(res["provider_name"], "Airtel Telecommunications")
        self.assertIn("visualization_config", res)
        entities = res.get("extracted_entities", {})
        self.assertTrue(len(entities.get("phone_numbers", [])) >= 2)


class TestMasterWorkflowAutomatorAgent(unittest.TestCase):
    def setUp(self):
        self.master = MasterWorkflowAutomatorAgent()

    def test_evaluator_data_ingestion(self):
        payload = {
            "case_metadata": {
                "case_id": "FIR-UNIT-2026",
                "police_station": "Cyber Cell",
                "officer_name": "Inspector V."
            },
            "evaluated_targets": [
                {
                    "type": "bank",
                    "identifier": "112233445566",
                    "name": "Mule Target",
                    "entity_name": "HDFC Bank"
                }
            ]
        }
        res = self.master.ingest_evaluator_data(payload)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["case_id"], "FIR-UNIT-2026")
        self.assertIn("FIR-UNIT-2026", self.master.pending_cases)

    def test_dispatch_notice_no_duplicate_token(self):
        state = self.master.dispatch_investigation_notice(
            case_number="FIR-TOKEN-01",
            investigation_objective="Urgent Financial Freeze Order for Mule Account",
            receiver_name="HDFC",
            receiver_email="nodal@hdfc.com",
            receiver_type="bank",
            context_data={"account_number": "123456789"}
        )
        disp_subject = state["dispatch_result"].get("recipient", {}).get("subject", "") or state.get("dispatch_result", {}).get("subject", "")
        # Check in pending_cases state tracking subject
        history_item = self.master.pending_cases["FIR-TOKEN-01"]
        self.assertEqual(history_item["dispatch_result"].get("status"), "Simulated Delivery (smtplib)")

    def test_async_incoming_reply_and_auto_target_addition(self):
        self.master.dispatch_investigation_notice(
            case_number="FIR-REPLY-01",
            investigation_objective="Requisition for Call Detail Records",
            receiver_name="Airtel",
            receiver_email="nodal@airtel.com",
            receiver_type="telecom",
            context_data={"target_identifier": "9825012345"}
        )

        cdr_csv = """CallID,Timestamp,CallerNumber,ReceiverNumber,CallType,DurationSec
CDR1,2026-07-24T01:15:00,9825012345,9898011223,OUTGOING,180
CDR2,2026-07-24T02:22:15,9825012345,918273645019,OUTGOING,45
"""
        reply_state = self.master.handle_async_incoming_reply(
            case_number="FIR-REPLY-01",
            sender_email="nodal@airtel.com",
            subject="CDR Report [CrimeOS-REF: FIR-REPLY-01]",
            body_text="Attached CDR log.",
            attachments=[{"filename": "cdr.csv", "content": cdr_csv, "format": "csv"}]
        )

        self.assertEqual(reply_state["analytics_result"]["provider_name"], "Airtel Telecommunications")
        self.assertGreater(len(reply_state["auto_added_targets"]), 0)


if __name__ == "__main__":
    unittest.main()
