# The Commute Tax

**Team 16 | ECS 163 | UC Davis** 

Michael Yeung, Tanner Nguyen, Lance Arnoco, Quanin Li, Michael Makhota
 
## Description

A data visualization storytelling website about rising commute times across all 50 US states from 2010 to 2024. Built with D3.js using a martini glass structure: a guided scrollytelling narrative followed by a free exploration section. The main visualization is a parallel coordinates plot where each line is one state, each axis is one year, and height represents average commute time in minutes. Lines are colored by region: Northeast, South, Midwest, West, and Mountain.

The storytelling section walks through five steps: introducing the chart, showing the decade-long rise in commutes from 2010 to 2019, highlighting the Northeast as the hardest hit region, revealing the 2021 COVID dip where every state dropped at once, and showing the rebound by 2024. After the guided section, users can click any state line to see that state's full commute history in a tooltip, and use region filter buttons to focus on one region at a time.

Data is from the US Census Bureau ACS Table S0801 (data.census.gov), included directly in data.js as 51 records covering 50 states and DC. 2020 is excluded because COVID disrupted Census collection that year.
 
## Installation + Execution
 
 **Execution**
- Render: https://ecs-163-project.onrender.com
- GitHub Pages: https://magicbattle.github.io/ECS-163-Project
## Installation
 
Clone the github repo. The project is static HTML, CSS, and JS with no build step needed.
 
**VS Code Live Server:**
Install the Live Server extension (VS CODE), right-click index.html, and select Open with Live Server.
 
## Data Source
 
US Census Bureau, American Community Survey, Table S0801
https://data.census.gov
