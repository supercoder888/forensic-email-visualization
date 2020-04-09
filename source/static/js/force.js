    var height = 830,
    width = 1200;
var margin = {
    top: -5,
    right: -5,
    bottom: -5,
    left: -5
};
var trans = [0, 0];
var scale = 1;
var toggle = 0;
var sidebar = d3.select(".sidebar");
var open = d3.select(".open");
var close = d3.select(".close");
var info = d3.select(".info");
var list = d3.select(".list");
var maxWeight = 1;

var expand_factor = 20;
var min_distance = 50;
//offsets for referencing email content of a node
var OFFSET_TO       = 0;
var OFFSET_DATE     = 1;
var OFFSET_SUB      = 2;
var OFFSET_CONTENT  = 3;

var nodeGraph = null;
var link;
var edges = [];
var current_selected; // stores the most recent selected node
var force = d3.layout.force()

    .charge(-250)
.linkDistance(function(d) {return min_distance + (expand_factor * Math.log2(maxWeight / d.weight));})
    .size([width, height]);


var drag = force.drag()
    .on("dragstart", dragstart);


var zoom = d3.behavior.zoom()
    .on("zoom", zoomed);


var svg = d3.select("#chart").append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.right + ")")
    .call(zoom);


var node = svg.append("g")
    .selectAll("circle");


var rect = svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "none")
    .style("pointer-events", "all");


var container = svg.append("g").attr("id", "plot");


function dragged(d) {
    d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);
}


function dragended(d) {
    d3.select(this).classed("dragging", false);
}


function zoomed() {
    trans = d3.event.translate;
    scale = d3.event.scale;
    container.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}


function mover(d) {
    $("#pop-up").fadeOut(100, function() {
        //PopUp content
        $("#pop-up-title").html(d.name);
        $("#pop-desc").html("Conversation partner: " + d.weight + "<br>Mail sent: " + (d.sent ? d.sent : '0') + "<br> Mail received: " + (d.recieved ? d.recieved : '0'));

        //PopUp position
        var popLeft = (d.x * scale) + trans[0] + 20;
        var popTop = (d.y * scale) + trans[1] + 20;
        $("#pop-up").css({
            "left": popLeft,
            "top": popTop
        });
        $("#pop-up").fadeIn(100);
    });
}

function mout(d) {
    $("#pop-up").fadeOut(50);
}

function click(d) {
    if (!d3.event.shiftKey) {
        current_selected = d;
        info.html("<h4>" + d.name + "</h4>" + "<hr>" + "Conversation partners: " + d.weight + "<br>" + "Emails sent: " + (d.sent ? d.sent : '0') + "<br>" + " Emails received: " + (d.recieved ? d.recieved : '0'));
        var subjects = "";

        var values = generateSubjects(d);
        list.html(values[0]);
        var contents = document.getElementById("mail_contents");
        contents.innerHTML = values[1];
        node.classed("selected", function(p) {
            return p.selected = p.prevSel = false;
        })
        d3.select(this).classed("selected", d.selected = !d.prevSel);
    } else {
        if (confirm('Are you sure you want to merge ' + d.name + " into " + current_selected.name + "?")) {
            d3.select(this).classed("selected", d.selected = !d.prevSel);
            merge();
            //no node should be selected after merge
            current_selected = null;
        }
    }

}


function generateSubjects(d) {
    if (!d.sub || d.sub.length == 0) {
        return ["No written emails!",""];
    }

    var hiddenHtml = "";
    var ret = "<ul>";
    console.log(d);
    for (var i = 0; i < d.sub.length; i+=4) {
        ret += "<li> <a class=\"showPopup\" href=\"#\" data-mailid=\"" + i + "\">" + d.sub[i+OFFSET_SUB] + "</a></li>";
        hiddenHtml += "<div id=\"mail-"+i+"\">";
        hiddenHtml += "<div id=\"from\">"+d.name+"</div>";
        hiddenHtml += "<div id=\"to\">"+d.sub[i+OFFSET_TO]+"</div>";
        hiddenHtml += "<div id=\"date\">"+d.sub[i+OFFSET_DATE]+"</div>";
        hiddenHtml += "<div id=\"content\">"+d.sub[i+OFFSET_CONTENT]+"</div>";
        hiddenHtml += "</div>";
      
    }

    ret += "</ul>";
    var array = [ret, hiddenHtml];
    return array;
}


function dragstart(d) {
    d3.event.sourceEvent.stopPropagation();
    d3.select(this).classed("fixed", d.fixed = true);
}


function cutOffLinks(node) {
    toSplice = nodeGraph.links.filter(
        function(e) {
            return (e.source === node) || (e.target === node);
        });
    toSplice.map(
        function(e) {
            nodeGraph.links.splice(nodeGraph.links.indexOf(e), 1);
        });
}


function insertMergeNodes() {
    force.stop();
    for (var j = 0; j < edges.length; j++) {
        nodeGraph.links.push(edges[j]);
    }
    link.remove();
    link = container.append("g")
        .attr("class", "links")
        .selectAll(".link")
        .data(nodeGraph.links)
        .enter().append("line")
        .attr("class", "link")
        .style("stroke-width", function(d) {
            return d.weight == 1 ? 1 : Math.log2(d.weight) * 2
        });


    node.remove();
    node = container.append("g")
        .attr("class", "nodes")
        .selectAll(".node")
        .data(nodeGraph.nodes)
        .enter().append("g")
        .attr("cx", function(d) {
            return d.x;
        })
        .attr("cy", function(d) {
            return d.y;
        })
        .on("click", click)
        .on("mouseover", mover)
        .on("mouseout", mout)
        .call(drag);
    node.append("circle")
        .attr("r", 10)
        .attr("class", "node")
        .style("fill", function(d) {
            return d.merged ? "red" : "#0080ff"
        });

    node.each(function(d) {
        d.selected = false;
        d.prevSel = false;
    });

    force.on("tick", function() {
        link.attr("x1", function(d) {
                return d.source.x;
            })
            .attr("y1", function(d) {
                return d.source.y;
            })
            .attr("x2", function(d) {
                return d.target.x;
            })
            .on("click", lclick)
            .attr("y2", function(d) {
                return d.target.y;
            });

        node.attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")";
        });

    });
}


function lclick(d) {
    console.log("link: ", d);
}

function merge() {
    //stop visualization when we'll manipulate data
    force.stop();
    var se = nodeGraph.nodes.filter(function(n) {
        return n.selected
    });
    var staticNode = se[1];
    var lostNode = se[0];

    //only two nodes can be merged at once
    if (se.length != 2) {
        alert('Wrong number of nodes selected! You can only merge two nodes!');
    } else {
        staticNode.merged = true;
        //tmp variable to gather all new edges for later insertion
        edges = [];

        //find all relevant edges and nodes
        for (var j = 0; j < nodeGraph.links.length; j++) {
            var mergedEdge;

            if (lostNode == nodeGraph.links[j].source) {
                mergedEdge = nodeGraph.links[j].target;
                //additional check what if mergedEdge is lostNode? result: link to nowhere
                if (mergedEdge == lostNode) {
                    mergedEdge = staticNode;
                }

                edges.push({
                    source: staticNode,
                    target: mergedEdge
                });
            } else if (lostNode == nodeGraph.links[j].target) {
                mergedEdge = nodeGraph.links[j].source;
                //additional check what if mergedEdge is lostNode? result: link to nowhere
                if (mergedEdge == lostNode) {
                    mergedEdge = staticNode;
                }

                edges.push({
                    source: staticNode,
                    target: mergedEdge
                });
            }
        }
        //remove lostNode and links from data array
        nodeGraph.nodes.splice(nodeGraph.nodes.indexOf(lostNode), 1);
        cutOffLinks(lostNode);

        //update attributes of merged Node
        staticNode.weight += lostNode.weight;
        staticNode.sent = staticNode.sent ? staticNode.sent + lostNode.sent : 0 + lostNode.sent;
        staticNode.recieved = staticNode.recieved ? staticNode.recieved + lostNode.recieved : 0 + lostNode.recieved;
        var lost_subs = lostNode.sub ? lostNode.sub : [];
        var tmp_sub = staticNode.sub ? staticNode.sub.concat(lost_subs) : [].concat(lost_subs);
        staticNode.sub = tmp_sub;

        insertMergeNodes();
        console.log("[" + new Date().toLocaleTimeString().toString() + "] " + lostNode.name + " merged into " + staticNode.name);
    }

    //after all changes we can go on with visualization
    force.resume();

}

function threshold(thresh) {
    nodeGraph.links.splice(0, nodeGraph.links.length);

        for (var i = 0; i < nodeGraph.links.length; i++) {
            if (nodeGraph.links[i].value > thresh) {edges.push(nodeGraph.links[i]);}
        }
    restart();
}



d3.json("/json/graph", function(error, json) {
    if (error) throw error;

    nodeGraph = json;
    for (var i = 0; i < nodeGraph.links.length; i++){
        if (maxWeight < nodeGraph.links[i].weight){
            maxWeight = nodeGraph.links[i].weight;
        }
    }

    force
        .nodes(json.nodes)
        .links(json.links)
        .start();

    //prepare the links
    link = container.append("g")
        .attr("class", "links")
        .selectAll(".link")
        .data(json.links)
        .enter().append("line")
        .attr("class", "link")
        .style("stroke-width", function(d) {
            return d.weight == 1 ? 1 : Math.log2(d.weight) * 2
        });

    node = container.append("g")
        .attr("class", "nodes")
        .selectAll(".node")
        .data(json.nodes)
        .enter().append("g")
        .attr("cx", function(d) {
            return d.x;
        })
        .attr("cy", function(d) {
            return d.y;
        })
        .on("click", click)
        .on("mouseover", mover)
        .on("mouseout", mout)
        .call(drag);

    node.append("circle")
        .attr("r", 10)
        .attr("class", "node");


    node.each(function(d) {
        d.merged = false;
        d.selected = false;
        d.prevSel = false;
    });
    force.on("tick", function() {
        link.attr("x1", function(d) {
                return d.source.x;
            })
            .attr("y1", function(d) {
                return d.source.y;
            })
            .attr("x2", function(d) {
                return d.target.x;
            })
            .attr("y2", function(d) {
                return d.target.y;
            });

        node.attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")";
        });


    });
});
