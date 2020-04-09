from termcolor import colored
import pypff    # lib to parse outlook files
import mailbox  # lib to parse mbox files
from email.parser import HeaderParser
from time import time
from email.utils import parsedate
import datetime


class Unboxer:
    def __init__(self, cursor):
        self.Cursor = cursor
        self.Key = 0

    def parse_mbox(self, f):
        """ Parses the given mbox file

        arguments:
        f -- path to mbox file
        """

        print("Getting mbox file"), colored(f, 'green')
        # for parsing duration
        t0 = time()
        # internal counter for parsed mail
        counter = 0
        mbox = mailbox.mbox(f)
        for msg in mbox:
            # malformed mail
            if not msg['Date']:
                continue

            # get unified datetime
            d = parsedate(msg['Date'])
            dt = datetime.datetime(*d[0:6])

            # gather the content of msg. check whether it is multipart or not
            if msg.is_multipart():
                content = ''
                for part in msg.get_payload():
                    part_string = part.get_payload(decode=True)
                    if part_string:
                        content += part_string
            else:
                content = msg.get_payload(decode=True)

            # malformed from?
            if not msg['From']:
                f = "[No From address found]"
            else:
                f = self.normalize(msg['From'])

            # malformed to?
            if not msg['To']:
                t = "No To address found"
            else:
                t = self.normalize(msg['To'])

            # malformed subject?
            if not msg['Subject']:
                sub = "[No Subject entered by the sender]"
            else:
                sub = msg['Subject'].decode('latin-1')

            # Insert finally in database
            self.insert(dt,
                        f,
                        t,
                        content.decode('latin-1'),
                        sub)
            counter += 1
            self.Key += 1
        t1 = time()
        print("Mails parsed:"), colored(counter, 'green')
        print("parsing takes: %f" % (t1-t0))
        print("---")

    def parse_ost_pst(self, f):
        """ Parses the given outlook file

        arguments:
        f -- path to pst/ost file
        """

        print("Getting ost/pst file"), colored(f, 'green')
        c = 0
        t0 = time()

        outlook = pypff.file()
        try:
            outlook.open(f)
        except IOError:
            print ("This is not a PST or OST file! No mails are parsed!")
            return

        root = outlook.get_root_folder()
        self.traverse(root, c)
        outlook.close()
        t1 = time()
        print("parsing takes: %f" % (t1-t0))
        print("%d messages are parsed" % c)

    def traverse(self, folder, c):
        """ Recursive method to travers the full outlook file tree

        arguments:
        folder -- current internal folder
        c -- counter for statistics
        """
        for i in range(0, folder.number_of_sub_messages):
            self.Key += 1
            msg = folder.get_sub_message(i)

            head = msg.get_transport_headers().encode('utf-8', 'replace')

            parser = HeaderParser()
            h = parser.parsestr(head)

            # create unified timestamp
            d = parsedate(h['Date'])
            try:
                dt = datetime.datetime(*d[0:6])
            except TypeError:
                print("Malformed Date")

            # get plain text
            content = msg.get_plain_text_body()

            # manipulated from?
            if not h['From']:
                f = "No From address found"
            else:
                f = self.normalize(h['From'])
            # manipulated to?
            if not h['To']:
                t = "No To address found"
            else:
                t = self.normalize(h['To'])

            # done, insert
            self.insert(dt, f,
                        t,
                        content, msg.get_subject())
            c += 1
        for f in folder.sub_folders:
            self.traverse(f, c)

    def insert(self, date, sender, recipient, content, subject):
        """ Inserts into the database """

        self.Cursor.execute("INSERT INTO pst(time, sender, recipient, content, \
                            subject) values (?, ?, ?, ?, ?)",
                            (date, sender, recipient, content, subject))

    def normalize(self, adr):
        """ Extracts only the mail address and converts it to lower case

        arguments:
        adr -- Output of mailparser from where the address should be extracted
        """

        if "<" in adr:
            return adr[adr.find("<")+1:adr.find(">")].lower()
        else:
            return adr.lower()
