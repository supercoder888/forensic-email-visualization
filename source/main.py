import argparse
import sqlite3
from unboxer import Unboxer  # Mailbox parser
from termcolor import colored
from flask import Flask  # Webserver for presentation
from flask import render_template
from flask import session, request
import json  # to generate output for d3
from bson import json_util  # for d3
import networkx as nx
from networkx.readwrite import json_graph

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/investigation", methods=['POST'])
def investigation():
    start = request.form['from_date']
    end = request.form['to_date']

    session['start'] = start
    session['end'] = end
    return render_template("investigation.html")


@app.route("/json/crossfilter")
def crossfilter_values():
    con = sqlite3.connect('data.sqlite')
    con.row_factory = zeilen_dict
    cur = con.cursor()
    cur.execute("SELECT * FROM pst")

    json_projects = []
    for project in cur:
        json_projects.append(project)
    json_projects = json.dumps(json_projects, default=json_util.default)
    con.close()
    return json_projects


@app.route("/json/graph")
def generate_graph():
    start = session['start']
    end = session['end']

    con = sqlite3.connect('data.sqlite')
    con.row_factory = zeilen_dict
    cur = con.cursor()
    if start and end:
        cur.execute("SELECT * FROM pst WHERE Time BETWEEN ? AND ?",
                    (start, end,))
    else:
        cur.execute("SELECT * FROM pst")
    g = nx.Graph()
    for m in cur:
        # is there already an edge?
        if g.has_edge(m['Sender'], m['Recipient']):
            # added this before, just update weight
            g[m['Sender']][m['Recipient']]['weight'] += 1
        else:
            # add new edge between Sender and Recipient
            g.add_edge(m['Sender'], m['Recipient'], weight=1)

        if 'sub' in g.node[m['Sender']]:
            g.node[m['Sender']]['sub'].append(m['Recipient'])
            g.node[m['Sender']]['sub'].append(m['Time'])
            g.node[m['Sender']]['sub'].append(m['Subject'])
            g.node[m['Sender']]['sub'].append(m['Content'])
        else:
            g.node[m['Sender']]['sub'] = [m['Recipient'],
                                          m['Time'],
                                          m['Subject'],
                                          m['Content']]

        # if attribute already exists, just update
        # attribute: sent
        if 'sent' in g.node[m['Sender']]:
            g.node[m['Sender']]['sent'] += 1
        else:
            g.node[m['Sender']]['sent'] = 1

        # attribute: recieved
        if 'recieved' in g.node[m['Recipient']]:
            g.node[m['Recipient']]['recieved'] += 1
        else:
            g.node[m['Recipient']]['recieved'] = 1

    for n in g:
        g.node[n]['name'] = n

    d = json_graph.node_link_data(g)  # node-link format to serialize
    con.close()
    json_graphs = []
    json_graphs = json.dumps(d, default=json_util.default)
    return json_graphs


def zeilen_dict(cursor, zeile):
    result = {}
    for colnr, col in enumerate(cursor.description):
        result[col[0]] = zeile[colnr]
    return result


if __name__ == '__main__':
    # set up parser for communication
    aparser = argparse.ArgumentParser()
    aparser.add_argument('-pst', nargs='*', type=str,
                         help="pst files to be parsed",
                         metavar="<path1, path2, ...>")
    aparser.add_argument('-ost', nargs='*', type=str,
                         help="ost files to be parsed",
                         metavar="<path1, path2, ...>")
    aparser.add_argument('-mbox', nargs='*', type=str,
                         help="mbox files to be parsed",
                         metavar="<path1, path2, ...>")
    args = aparser.parse_args()
    # --------------------------------------------------------------------------

    # init database
    con = sqlite3.connect('data.sqlite')
    con.text_factory = str
    with con:
        cur = con.cursor()
        cur.execute("DROP TABLE IF EXISTS pst")
        cur.execute("CREATE TABLE pst(Id INT PRIMARY KEY,   \
                    Time TIMESTAMP,                         \
                    Sender TEXT,                            \
                    Recipient TEXT,                         \
                    Content TEXT,                           \
                    Subject TEXT)")

        # for mailbox parsing
        p = Unboxer(cur)

        # parse arguments and mailboxes :)
        if args.pst:
            for o in args.pst:
                p.parse_ost_pst(o)
        if args.ost:
            for o in args.ost:
                p.parse_ost_pst(o)
        if args.mbox:
            for m in args.mbox:
                p.parse_mbox(m)
        print("Mails totally parsed:"), colored(p.Key, 'green')
    # --------------------------------------------------------------------------
    app.secret_key = 'investigation'
    app.run(host='localhost', port=4242, debug=False, use_reloader=False)
