#!/usr/bin/env python3

# Reference: https://gist.github.com/zed/9336086

import json
import os
from email.header import decode_header, make_header
from datetime import datetime
from imaplib import IMAP4_SSL

DATE_FORMAT = "%d-%b-%Y"  # DD-Mon-YYYY e.g., 3-Mar-2014
# DATES = [f'{n}-Jul-2022' for n in range(28, 32)]
# DATES = ['01-Aug-2022']
DATES = [f'{n}-Aug-2022' for n in range(16, 31)]
HERE = os.path.dirname(os.path.abspath(__file__))

def decode_header(header_string):
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


if __name__ == '__main__':
    config = None

    node_env = os.environ.get('NODE_ENV', 'dev')
    config_json_file_path = os.path.join(HERE, '..', 'config', f'{node_env}.json')
    with open(config_json_file_path, 'r') as config_json_file:
        config_json = config_json_file.read()
        config = json.loads(config_json)
    smtp_host = config['delivery']['email']['host']

    with IMAP4_SSL(smtp_host) as mail:
        email_auth = config['delivery']['email']['auth']
        mail.login(email_auth['user'], email_auth['pass'])
        mail.select('INBOX', readonly=True)
        mail.select('INBOX', readonly=True)

        print('date,count')
        for start in DATES:
            on_date = datetime.strptime(start,
                                        DATE_FORMAT).strftime(DATE_FORMAT)

            # good reference for the search query, see "criteria" section in:
            # https://www.php.net/manual/en/function.imap-search.php
            search_query = f'ON "{on_date}"'

            ret_type, [msg_ids] = mail.search(None, search_query)
            parsed_msg_ids = msg_ids.split()
            print(f'{on_date},{len(parsed_msg_ids)}')
