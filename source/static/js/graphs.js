queue()
    .defer(d3.json, "/json/crossfilter")
    .await(make_charts);

function make_charts(error, json) {
	
	//Clean projectsJson data
	var projects = json;
	var dateFormat = d3.time.format("%Y-%m-%d %X");
	projects.forEach(function(d) {
        d["Time"] = dateFormat.parse(d["Time"]);
	});
    var ndx = crossfilter(projects);

    var dateDim = ndx.dimension(function(d) { return d["Time"]; });
    var fromDim = ndx.dimension(function(d) { return d["Sender"]; });
    var hour = ndx.dimension(function(d) {return d["Time"].getHours() + d["Time"].getMinutes() / 60;});
    var dayOfWeeks = ndx.dimension(function (d) {
        var day = d["Time"].getDay();
        var name = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return day + '.' + name[day];
    });
        
    var hours = hour.group(Math.floor);
    var dayOfWeekGroup = dayOfWeeks.group();

    var all = ndx.groupAll();
    var numEmailsByDate = dateDim.group();
    var numEmailsByFrom = fromDim.group().reduceCount();

    var minDate = dateDim.bottom(1)[0]["Time"];
    var maxDate = dateDim.top(1)[0]["Time"];

    var timeChart = dc.barChart('#time-chart');
    var volume = dc.barChart('#time-control');
    var numberOfEmails = dc.numberDisplay("#numberOfEmails");
    var fromTypeChart = dc.rowChart("#fromTypeChart");
    var daytime = dc.barChart('#timeOf');
    var weekDayPie = dc.pieChart('#weekDayPie'); 

    timeChart
        .width(600)
        .height(150)
        .margins({top: 10, right: 50, bottom: 20, left: 50})
        .dimension(dateDim)
        .group(dateDim.group(d3.time.day))
        //.round(d3.time.day.round)
        .transitionDuration(500)
        .x(d3.time.scale().domain([minDate, maxDate]))
        .elasticY(true)
        .renderHorizontalGridLines(true)
        .rangeChart(volume);

    volume
        .width(600)
        .height(60)
        .centerBar(true)
        .margins({top: 0, right: 50, bottom: 30, left: 50})
        .dimension(dateDim)
        .group(dateDim.group(d3.time.day))
        .transitionDuration(500)
        .x(d3.time.scale().domain([minDate, maxDate]));
        
    numberOfEmails
        .formatNumber(d3.format("d"))
        .valueAccessor(function(d){return d; })
        .group(all);


    weekDayPie
        .width(300)
        .height(220)
        .radius(90)
        .dimension(dayOfWeeks)
        .group(dayOfWeekGroup)
        .renderLabel(true)
        .innerRadius(20);

    fromTypeChart
        .width(300)
        .height(340)
        .dimension(fromDim)
        .renderLabel(true)
        .group(numEmailsByFrom)
        .cap(15)
        .ordering(function (d) {return -d.value})
        .xAxis().ticks(4);

    daytime
        .width(600)
        .height(160)
        .margins({top: 10, right: 50, bottom: 30, left: 50})
        .dimension(hour)
        .group(hours)
        .elasticY(true)
        .xAxisLabel("Daytime (hrs)")
        .brushOn(false)
        .title(function(d){
            return d.data.key + ":00 hrs"
            + "\nNumber of Emails: " + d.data.value;
         })
        .x(d3.scale.linear()
        .domain([0,24])
        .rangeRound([0, 10 * 24]));

    dc.renderAll()
};
