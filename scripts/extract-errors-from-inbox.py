#!/usr/bin/env python3

# Reference: https://gist.github.com/zed/9336086

import csv
import json
import os
import re
import sys

from email import message_from_bytes
from email.header import decode_header, make_header
from imaplib import IMAP4_SSL

EMAIL_REGEXES = [
    [r'^<(.+)>:', re.MULTILINE], # gmail
    [r'<mailto:(.+)>$', re.MULTILINE], # outlook
]
HERE = os.path.dirname(os.path.abspath(__file__))


def optionally_decode_header(header_string):
    try:
        decoded_seq = decode_header(header_string)
        return str(make_header(decoded_seq))
    except Exception:  # fallback: return as is
        return header_string


def get_text(msg, fallback_encoding='utf-8', errors='replace'):
    """Extract plain text from email."""
    text = []
    for part in msg.walk():
        if part.get_content_type() == 'text/plain':
            p = part.get_payload(decode=True)
            if p is not None:
                text.append(
                    p.decode(part.get_charset() or fallback_encoding, errors))
    return "\n".join(text)


def extract_email_from_body(body):
    for (pattern, flags) in EMAIL_REGEXES:
        matches = re.findall(pattern, body, flags=flags)
        if matches and len(matches) == 1:
            return matches[0]

    return None


def extract_reason_from_body(body):
    if 'NoSuchUser' in body \
        or 'mailbox not found' in body \
        or 'User unknown' in body \
        or 'user does not exist' in body:
        return "Mailbox not found"

    if 'over quota' in body or 'mailbox for user is full' in body:
        return "Mailbox over quota"

    if 'DisabledUser' in body or 'mailbox is disabled' in body:
        return "Mailbox disabled"

    if 'Host or domain name' in body:
        return "Domain doesn't exist"

    if 'S2017062302' in body or 'mailbox unavailable' in body:
        return "Mailbox unavailable (generic error)"

    return 'Unknown'


def main():
    config = None

    node_env = os.environ.get('NODE_ENV', 'dev')
    config_json_file_path = os.path.join(HERE, '..', 'config', f'{node_env}.json')
    with open(config_json_file_path, 'r') as config_json_file:
        config_json = config_json_file.read()
        config = json.loads(config_json)
    smtp_host = config['delivery']['email']['host']

    with IMAP4_SSL(smtp_host) as mail:
        writer = csv.writer(sys.stdout)

        email_auth = config['delivery']['email']['auth']
        mail.login(email_auth['user'], email_auth['pass'])
        mail.select('INBOX', readonly=True)

        writer.writerow(['Email', 'Failure Reason', 'Headers (for debugging)', 'Body (for debugging)'])
        _, [msg_ids] = mail.search(None, 'ALL')
        parsed_msg_ids = msg_ids.split()

        for num in parsed_msg_ids:
            _, msg_data = mail.fetch(num.decode('ascii'), '(RFC822)')
            for response_part in msg_data:
                if not isinstance(response_part, tuple):
                    continue

                msg = message_from_bytes(response_part[1])

                from_email = optionally_decode_header(msg['from'])
                if 'postmaster' not in from_email and 'DAEMON' not in from_email:
                    # ignore regular emails
                    continue

                body = get_text(msg)
                email = extract_email_from_body(body)
                reason = extract_reason_from_body(body)

                if reason == 'Unknown':
                    combined_headers = ''
                    for header in ['subject', 'to', 'from', 'date']:
                        header_text = optionally_decode_header(msg[header])
                        combined_headers += '%-8s: %s\n' % (header.upper(), header_text)

                    print('=== UNKNOWN ERROR, DETAILS: ===', file=sys.stderr)
                    print(combined_headers, file=sys.stderr)
                    print(body, file=sys.stderr)

                    writer.writerow([email, reason, combined_headers, body])
                    continue
                    # quit(0)

                writer.writerow([email, reason])


if __name__ == '__main__':
    main()
