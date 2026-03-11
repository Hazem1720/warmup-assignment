const fs = require("fs");

function getShiftDuration(startTime, endTime) {

    function toSeconds(time) {
        time = time.trim().toLowerCase();
        let [clock, period] = time.split(" ");
        let [h, m, s] = clock.split(":").map(Number);

        if (period === "pm" && h !== 12) h += 12;
        if (period === "am" && h === 12) h = 0;

        return h * 3600 + m * 60 + s;
    }

    let start = toSeconds(startTime);
    let end = toSeconds(endTime);

    let diff = end - start;

    // FIX for overnight shift
    if (diff < 0) diff += 24 * 3600;

    let h = Math.floor(diff / 3600);
    let m = Math.floor((diff % 3600) / 60);
    let s = diff % 60;

    m = String(m).padStart(2, "0");
    s = String(s).padStart(2, "0");

    return `${h}:${m}:${s}`;
}


// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
 

    function toSeconds(time) {
        time = time.trim().toLowerCase();
        let [clock, period] = time.split(" ");
        let [h, m, s] = clock.split(":").map(Number);

        if (period === "pm" && h !== 12) h += 12;
        if (period === "am" && h === 12) h = 0;

        return h * 3600 + m * 60 + s;
    }

    let start = toSeconds(startTime);
    let end = toSeconds(endTime);

    const startDelivery = 8 * 3600;      // 8:00 AM
    const endDelivery = 22 * 3600;       // 10:00 PM

    let idle = 0;

    if (start < startDelivery) {
        idle += startDelivery - start;
    }

    if (end > endDelivery) {
        idle += end - endDelivery;
    }

    let h = Math.floor(idle / 3600);
    let m = Math.floor((idle % 3600) / 60);
    let s = idle % 60;

    m = String(m).padStart(2, "0");
    s = String(s).padStart(2, "0");

    return `${h}:${m}:${s}`;

}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {

    function toSeconds(time) {
        let [h, m, s] = time.split(":").map(Number);
        return h * 3600 + m * 60 + s;
    }

    let shiftSec = toSeconds(shiftDuration);
    let idleSec = toSeconds(idleTime);

    let activeSec = shiftSec - idleSec;

    let h = Math.floor(activeSec / 3600);
    let m = Math.floor((activeSec % 3600) / 60);
    let s = activeSec % 60;

    m = String(m).padStart(2, "0");
    s = String(s).padStart(2, "0");

    return `${h}:${m}:${s}`;
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {

    function timeToSeconds(time) {
        let parts = time.split(":").map(Number);
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    let activeSeconds = timeToSeconds(activeTime);

    let quotaSeconds;

    if (date >= "2025-04-10" && date <= "2025-04-30") {
        quotaSeconds = timeToSeconds("6:00:00");
    } else {
        quotaSeconds = timeToSeconds("8:24:00");
    }

    return activeSeconds >= quotaSeconds;
}
// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {

    let content = fs.readFileSync(textFile, "utf8");
    let lines = content.trim().split("\n");

    // 1️⃣ Check for duplicate (same driverID + date)
    for (let line of lines) {

        let parts = line.split(",");

        let driverID = parts[0];
        let date = parts[2];

        if (driverID === shiftObj.driverID && date === shiftObj.date) {
            return {};
        }
    }

    // 2️⃣ Calculate values
    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let met = metQuota(shiftObj.date, activeTime);

    let newObj = {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: met,
        hasBonus: false
    };

    // 3️⃣ Create new line for file
    let newLine = [
        newObj.driverID,
        newObj.driverName,
        newObj.date,
        newObj.startTime,
        newObj.endTime,
        newObj.shiftDuration,
        newObj.idleTime,
        newObj.activeTime,
        newObj.metQuota,
        newObj.hasBonus
    ].join(",");

    // 4️⃣ Find last record of this driverID
    let index = -1;

    for (let i = 0; i < lines.length; i++) {
        let parts = lines[i].split(",");
        if (parts[0] === shiftObj.driverID) {
            index = i;
        }
    }

    // 5️⃣ Insert correctly
    if (index === -1) {
        lines.push(newLine);
    } else {
        lines.splice(index + 1, 0, newLine);
    }

    // 6️⃣ Write back to file
    fs.writeFileSync(textFile, lines.join("\n"));

    return newObj;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================


function setBonus(textFile, driverID, date, newValue){

    let data = fs.readFileSync(textFile,"utf8");
    let lines = data.trim().split("\n");

    for(let i=1;i<lines.length;i++){

        let row = lines[i].split(",");

        if(row[0] === driverID && row[2] === date){

            row[9] = newValue;
            lines[i] = row.join(",");
            break;

        }
    }

    fs.writeFileSync(textFile,lines.join("\n"));
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month){

    let data = fs.readFileSync(textFile,"utf8");
    let lines = data.trim().split("\n");

    let count = 0;
    let driverExists = false;

    if(month.length === 1){
        month = "0" + month;
    }

    for(let i=1;i<lines.length;i++){

        let row = lines[i].split(",");

        if(row[0] === driverID){
            driverExists = true;

            let rowMonth = row[2].split("-")[1];

            if(rowMonth === month && row[9] === "true"){
                count++;
            }
        }
    }

    if(!driverExists){
        return -1;
    }

    return count;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {

    let data = fs.readFileSync(textFile, "utf8");
    let lines = data.trim().split("\n");

    let totalSeconds = 0;

    // convert month to 2-digit string
    month = month.toString().padStart(2, "0");

    for (let i = 1; i < lines.length; i++) {

        let row = lines[i].split(",");

        let id = row[0];
        let date = row[2];
        let activeTime = row[7];

        let rowMonth = date.split("-")[1];

        if (id === driverID && rowMonth === month) {

            let parts = activeTime.split(":");

            let h = parseInt(parts[0]);
            let m = parseInt(parts[1]);
            let s = parseInt(parts[2]);

            totalSeconds += h * 3600 + m * 60 + s;
        }
    }

    // convert seconds back to hhh:mm:ss
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;

    let mm = minutes.toString().padStart(2, "0");
    let ss = seconds.toString().padStart(2, "0");

    return `${hours}:${mm}:${ss}`;
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {

    let shifts = fs.readFileSync(textFile, "utf8").trim().split("\n");
    let rates = fs.readFileSync(rateFile, "utf8").trim().split("\n");

    let dayOff = "";

    // get driver's day off from rate file
    for (let line of rates) {
        let parts = line.split(",");
        if (parts[0] === driverID) {
            dayOff = parts[1];
        }
    }

    let totalSeconds = 0;

    for (let i = 1; i < shifts.length; i++) {

        let row = shifts[i].split(",");
        let id = row[0];
        let date = row[2];

        if (id !== driverID) continue;

        let m = parseInt(date.split("-")[1]);
        if (m !== parseInt(month)) continue;

        // get day name from date
        let day = new Date(date).toLocaleDateString("en-US", { weekday: "long" });

        // skip if it's the driver's day off
        if (day === dayOff) continue;

        // apply correct daily quota
        let dailyQuotaSeconds;
        if (date >= "2025-04-10" && date <= "2025-04-30") {
            dailyQuotaSeconds = 6 * 3600;            // 6:00:00
        } else {
            dailyQuotaSeconds = 8 * 3600 + 24 * 60; // 8:24:00
        }

        totalSeconds += dailyQuotaSeconds;
    }

    // reduce 2 hours per bonus
    totalSeconds -= bonusCount * 2 * 3600;

    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;

    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {

    let rates = fs.readFileSync(rateFile, "utf8").trim().split("\n");

    let basePay = 0;
    let tier = 0;

    // find driver in rate file
    for (let line of rates) {
        let parts = line.split(",");
        if (parts[0] === driverID) {
            basePay = parseInt(parts[2]);
            tier = parseInt(parts[3]);
        }
    }

    // convert hhh:mm:ss → seconds
    function toSeconds(time) {
        let t = time.split(":").map(Number);
        return t[0]*3600 + t[1]*60 + t[2];
    }

    let actualSec = toSeconds(actualHours);
    let requiredSec = toSeconds(requiredHours);

    // if worked enough hours
    if (actualSec >= requiredSec) {
        return basePay;
    }

    let missingSec = requiredSec - actualSec;
    let missingHours = Math.floor(missingSec / 3600);

    // allowance per tier
    let allowance = {
        1: 50,
        2: 20,
        3: 10,
        4: 3
    };

    let billableMissing = missingHours - allowance[tier];

    if (billableMissing < 0) billableMissing = 0;

    let deductionRatePerHour = Math.floor(basePay / 185);
    let salaryDeduction = billableMissing * deductionRatePerHour;

    let netPay = basePay - salaryDeduction;

    return netPay;
}
module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
