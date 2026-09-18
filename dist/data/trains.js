const ALL_DAYS = [true, true, true, true, true, true, true];
const days = (...idx) => ALL_DAYS.map((_, i) => idx.includes(i));
function toStops(raw) {
    return raw.map(([code, name, arrival, departure, distanceKm, day, platform]) => ({
        stationCode: code,
        stationName: name,
        arrival,
        departure,
        haltMinutes: haltBetween(arrival, departure),
        distanceKm,
        day,
        platform: platform ?? null,
    }));
}
function haltBetween(arrival, departure) {
    if (!arrival || !departure)
        return 0;
    const [ah = 0, am = 0] = arrival.split(':').map(Number);
    const [dh = 0, dm = 0] = departure.split(':').map(Number);
    let minutes = dh * 60 + dm - (ah * 60 + am);
    if (minutes < 0)
        minutes += 24 * 60;
    return minutes;
}
function makeTrain(number, name, type, classes, runsOn, raw, hasPantry = true) {
    const first = raw[0];
    const last = raw[raw.length - 1];
    if (!first || !last)
        throw new Error(`Train ${number} has no stops`);
    return {
        train: {
            number,
            name,
            type,
            fromStationCode: first[0],
            fromStationName: first[1],
            toStationCode: last[0],
            toStationName: last[1],
            runsOn,
            classes,
            hasPantry,
        },
        stops: toStops(raw),
    };
}
/**
 * Sample timetable data for the offline `mock` provider.
 *
 * Timings, halts and distances are approximate and are NOT an authoritative
 * timetable — switch to a live provider for anything you will act on.
 */
export const TRAINS = [
    makeTrain('12951', 'Mumbai Rajdhani Express', 'Rajdhani', ['1A', '2A', '3A'], ALL_DAYS, [
        ['BCT', 'Mumbai Central', null, '17:00', 0, 1, '5'],
        ['BRC', 'Vadodara Junction', '20:53', '20:58', 392, 1, '3'],
        ['KOTA', 'Kota Junction', '02:55', '03:00', 1071, 2, '2'],
        ['NDLS', 'New Delhi', '08:32', null, 1384, 2, '16'],
    ]),
    makeTrain('12952', 'New Delhi - Mumbai Central Rajdhani Express', 'Rajdhani', ['1A', '2A', '3A'], ALL_DAYS, [
        ['NDLS', 'New Delhi', null, '16:55', 0, 1, '16'],
        ['KOTA', 'Kota Junction', '22:15', '22:20', 313, 1, '1'],
        ['BRC', 'Vadodara Junction', '04:20', '04:25', 992, 2, '4'],
        ['BCT', 'Mumbai Central', '08:35', null, 1384, 2, '3'],
    ]),
    makeTrain('12953', 'August Kranti Rajdhani Express', 'Rajdhani', ['1A', '2A', '3A'], ALL_DAYS, [
        ['BCT', 'Mumbai Central', null, '17:40', 0, 1, '2'],
        ['ST', 'Surat', '20:08', '20:13', 263, 1, '3'],
        ['BRC', 'Vadodara Junction', '21:38', '21:43', 392, 1, '4'],
        ['KOTA', 'Kota Junction', '03:35', '03:40', 1071, 2, '3'],
        ['NZM', 'Hazrat Nizamuddin', '09:55', null, 1367, 2, '5'],
    ]),
    makeTrain('12301', 'Howrah Rajdhani Express', 'Rajdhani', ['1A', '2A', '3A'], ALL_DAYS, [
        ['HWH', 'Howrah Junction', null, '16:50', 0, 1, '1'],
        ['ASN', 'Asansol Junction', '18:55', '18:58', 200, 1, '3'],
        ['GAYA', 'Gaya Junction', '21:20', '21:25', 450, 1, '1'],
        ['CNB', 'Kanpur Central', '03:05', '03:10', 1010, 2, '5'],
        ['NDLS', 'New Delhi', '09:55', null, 1451, 2, '16'],
    ]),
    makeTrain('12302', 'New Delhi - Howrah Rajdhani Express', 'Rajdhani', ['1A', '2A', '3A'], ALL_DAYS, [
        ['NDLS', 'New Delhi', null, '16:50', 0, 1, '16'],
        ['CNB', 'Kanpur Central', '22:00', '22:05', 441, 1, '1'],
        ['GAYA', 'Gaya Junction', '03:35', '03:40', 1001, 2, '2'],
        ['ASN', 'Asansol Junction', '06:05', '06:08', 1251, 2, '2'],
        ['HWH', 'Howrah Junction', '09:55', null, 1451, 2, '9'],
    ]),
    makeTrain('12621', 'Tamil Nadu Express', 'Superfast', ['1A', '2A', '3A', 'SL'], ALL_DAYS, [
        ['MAS', 'MGR Chennai Central', null, '22:00', 0, 1, '9'],
        ['BZA', 'Vijayawada Junction', '04:15', '04:25', 431, 2, '1'],
        ['NGP', 'Nagpur Junction', '13:00', '13:10', 1092, 2, '1'],
        ['BPL', 'Bhopal Junction', '18:35', '18:45', 1482, 2, '1'],
        ['JHS', 'Jhansi Junction', '22:10', '22:20', 1773, 2, '2'],
        ['AGC', 'Agra Cantt', '00:45', '00:50', 2000, 3, '1'],
        ['NDLS', 'New Delhi', '07:00', null, 2180, 3, '12'],
    ]),
    makeTrain('12622', 'Tamil Nadu Express', 'Superfast', ['1A', '2A', '3A', 'SL'], ALL_DAYS, [
        ['NDLS', 'New Delhi', null, '22:30', 0, 1, '12'],
        ['AGC', 'Agra Cantt', '00:45', '00:50', 195, 2, '3'],
        ['JHS', 'Jhansi Junction', '03:05', '03:15', 415, 2, '1'],
        ['BPL', 'Bhopal Junction', '06:55', '07:05', 705, 2, '3'],
        ['NGP', 'Nagpur Junction', '12:40', '12:50', 1095, 2, '2'],
        ['BZA', 'Vijayawada Junction', '21:35', '21:45', 1755, 2, '4'],
        ['MAS', 'MGR Chennai Central', '05:00', null, 2180, 3, '7'],
    ]),
    makeTrain('12627', 'Karnataka Express', 'Superfast', ['1A', '2A', '3A', 'SL'], ALL_DAYS, [
        ['SBC', 'KSR Bengaluru City Junction', null, '19:20', 0, 1, '8'],
        ['SC', 'Secunderabad Junction', '06:20', '06:35', 610, 2, '10'],
        ['NGP', 'Nagpur Junction', '13:45', '13:55', 1190, 2, '3'],
        ['BPL', 'Bhopal Junction', '19:25', '19:35', 1580, 2, '1'],
        ['JHS', 'Jhansi Junction', '22:45', '22:55', 1871, 2, '3'],
        ['AGC', 'Agra Cantt', '01:20', '01:25', 2098, 3, '2'],
        ['NDLS', 'New Delhi', '06:40', null, 2278, 3, '14'],
    ]),
    makeTrain('12628', 'Karnataka Express', 'Superfast', ['1A', '2A', '3A', 'SL'], ALL_DAYS, [
        ['NDLS', 'New Delhi', null, '21:15', 0, 1, '14'],
        ['AGC', 'Agra Cantt', '23:50', '23:55', 180, 1, '1'],
        ['JHS', 'Jhansi Junction', '02:20', '02:30', 407, 2, '2'],
        ['BPL', 'Bhopal Junction', '06:05', '06:15', 698, 2, '2'],
        ['NGP', 'Nagpur Junction', '11:55', '12:05', 1088, 2, '1'],
        ['SC', 'Secunderabad Junction', '19:30', '19:45', 1668, 2, '10'],
        ['SBC', 'KSR Bengaluru City Junction', '07:30', null, 2278, 3, '6'],
    ]),
    makeTrain('12002', 'Bhopal Shatabdi Express', 'Shatabdi', ['EC', 'CC'], ALL_DAYS, [
        ['NDLS', 'New Delhi', null, '06:00', 0, 1, '1'],
        ['AGC', 'Agra Cantt', '07:38', '07:40', 195, 1, '1'],
        ['GWL', 'Gwalior Junction', '08:55', '08:57', 313, 1, '1'],
        ['JHS', 'Jhansi Junction', '09:53', '09:58', 415, 1, '2'],
        ['BPL', 'Bhopal Junction', '13:33', null, 705, 1, '1'],
    ], false),
    makeTrain('12001', 'Bhopal Shatabdi Express', 'Shatabdi', ['EC', 'CC'], ALL_DAYS, [
        ['BPL', 'Bhopal Junction', null, '14:45', 0, 1, '1'],
        ['JHS', 'Jhansi Junction', '17:53', '17:58', 290, 1, '1'],
        ['GWL', 'Gwalior Junction', '18:48', '18:50', 392, 1, '1'],
        ['AGC', 'Agra Cantt', '20:10', '20:12', 510, 1, '2'],
        ['NDLS', 'New Delhi', '22:30', null, 705, 1, '1'],
    ], false),
    makeTrain('12049', 'Gatimaan Express', 'Gatimaan', ['EC', 'CC'], days(0, 1, 2, 3, 4, 6), [
        ['NZM', 'Hazrat Nizamuddin', null, '08:10', 0, 1, '1'],
        ['AGC', 'Agra Cantt', '09:50', '09:52', 188, 1, '1'],
        ['GWL', 'Gwalior Junction', '11:08', '11:10', 306, 1, '1'],
        ['JHS', 'Jhansi Junction', '12:00', null, 403, 1, '2'],
    ], false),
    makeTrain('22435', 'Varanasi Vande Bharat Express', 'Vande Bharat', ['EC', 'CC'], days(0, 1, 3, 4, 5, 6), [
        ['NDLS', 'New Delhi', null, '06:00', 0, 1, '2'],
        ['CNB', 'Kanpur Central', '09:10', '09:15', 441, 1, '1'],
        ['ALD', 'Prayagraj Junction', '11:23', '11:28', 634, 1, '5'],
        ['BSB', 'Varanasi Junction', '14:00', null, 759, 1, '1'],
    ], false),
    makeTrain('12013', 'Amritsar Shatabdi Express', 'Shatabdi', ['EC', 'CC'], ALL_DAYS, [
        ['NDLS', 'New Delhi', null, '16:30', 0, 1, '1'],
        ['UMB', 'Ambala Cantt Junction', '18:43', '18:48', 200, 1, '1'],
        ['LDH', 'Ludhiana Junction', '19:55', '20:00', 310, 1, '1'],
        ['JUC', 'Jalandhar City', '20:37', '20:39', 366, 1, '1'],
        ['ASR', 'Amritsar Junction', '22:00', null, 449, 1, '1'],
    ], false),
    makeTrain('12015', 'Ajmer Shatabdi Express', 'Shatabdi', ['EC', 'CC'], ALL_DAYS, [
        ['NDLS', 'New Delhi', null, '06:05', 0, 1, '2'],
        ['JP', 'Jaipur Junction', '10:35', '10:40', 308, 1, '1'],
        ['AII', 'Ajmer Junction', '12:40', null, 443, 1, '1'],
    ], false),
    makeTrain('12009', 'Ahmedabad Shatabdi Express', 'Shatabdi', ['EC', 'CC'], days(0, 1, 2, 3, 4, 5), [
        ['BCT', 'Mumbai Central', null, '06:25', 0, 1, '5'],
        ['ST', 'Surat', '09:07', '09:10', 263, 1, '2'],
        ['BRC', 'Vadodara Junction', '10:23', '10:26', 392, 1, '3'],
        ['ADI', 'Ahmedabad Junction', '12:40', null, 493, 1, '1'],
    ], false),
    makeTrain('12027', 'Bengaluru - Chennai Shatabdi Express', 'Shatabdi', ['EC', 'CC'], days(0, 1, 2, 3, 4, 6), [
        ['SBC', 'KSR Bengaluru City Junction', null, '06:00', 0, 1, '1'],
        ['MAS', 'MGR Chennai Central', '11:00', null, 362, 1, '5'],
    ], false),
    makeTrain('12623', 'Thiruvananthapuram Mail', 'Mail', ['1A', '2A', '3A', 'SL'], ALL_DAYS, [
        ['MAS', 'MGR Chennai Central', null, '19:45', 0, 1, '9'],
        ['CBE', 'Coimbatore Junction', '02:20', '02:25', 496, 2, '2'],
        ['ERS', 'Ernakulam Junction', '06:40', '06:45', 690, 2, '2'],
        ['TVC', 'Thiruvananthapuram Central', '11:00', null, 925, 2, '1'],
    ]),
    makeTrain('12723', 'Telangana Express', 'Superfast', ['1A', '2A', '3A', 'SL'], ALL_DAYS, [
        ['SC', 'Secunderabad Junction', null, '06:25', 0, 1, '10'],
        ['NGP', 'Nagpur Junction', '13:40', '13:50', 581, 1, '4'],
        ['BPL', 'Bhopal Junction', '19:20', '19:30', 971, 1, '2'],
        ['JHS', 'Jhansi Junction', '22:40', '22:50', 1262, 1, '4'],
        ['AGC', 'Agra Cantt', '01:15', '01:20', 1489, 2, '3'],
        ['NDLS', 'New Delhi', '06:35', null, 1669, 2, '10'],
    ]),
    makeTrain('12309', 'Rajendra Nagar Patna Rajdhani Express', 'Rajdhani', ['1A', '2A', '3A'], ALL_DAYS, [
        ['PNBE', 'Patna Junction', null, '19:15', 0, 1, '1'],
        ['GAYA', 'Gaya Junction', '21:05', '21:10', 92, 1, '2'],
        ['CNB', 'Kanpur Central', '02:45', '02:50', 620, 2, '1'],
        ['NDLS', 'New Delhi', '08:40', null, 1061, 2, '16'],
    ]),
    makeTrain('12129', 'Azad Hind Express', 'Superfast', ['1A', '2A', '3A', 'SL'], ALL_DAYS, [
        ['HWH', 'Howrah Junction', null, '20:20', 0, 1, '12'],
        ['TATA', 'Tatanagar Junction', '23:40', '23:45', 250, 1, '2'],
        ['R', 'Raipur Junction', '07:20', '07:30', 780, 2, '1'],
        ['NGP', 'Nagpur Junction', '12:10', '12:20', 1070, 2, '2'],
        ['PUNE', 'Pune Junction', '23:55', null, 1740, 2, '1'],
    ]),
    makeTrain('22301', 'Howrah - New Jalpaiguri Vande Bharat Express', 'Vande Bharat', ['EC', 'CC'], days(0, 1, 2, 4, 5, 6), [
        ['HWH', 'Howrah Junction', null, '05:55', 0, 1, '22'],
        ['NJP', 'New Jalpaiguri', '13:25', null, 561, 1, '1'],
    ], false),
    makeTrain('12163', 'Dadar - Chennai Express', 'Superfast', ['2A', '3A', 'SL'], days(1, 4, 6), [
        ['DR', 'Dadar', null, '20:20', 0, 1, '7'],
        ['PUNE', 'Pune Junction', '00:05', '00:15', 190, 2, '1'],
        ['SC', 'Secunderabad Junction', '11:30', '11:45', 790, 2, '9'],
        ['BZA', 'Vijayawada Junction', '17:05', '17:15', 1100, 2, '3'],
        ['MAS', 'MGR Chennai Central', '23:45', null, 1530, 2, '8'],
    ]),
    makeTrain('12903', 'Golden Temple Mail', 'Mail', ['1A', '2A', '3A', 'SL'], ALL_DAYS, [
        ['BCT', 'Mumbai Central', null, '21:25', 0, 1, '3'],
        ['ST', 'Surat', '00:08', '00:13', 263, 2, '2'],
        ['BRC', 'Vadodara Junction', '01:38', '01:43', 392, 2, '4'],
        ['KOTA', 'Kota Junction', '07:45', '07:55', 1071, 2, '2'],
        ['NDLS', 'New Delhi', '14:45', '15:05', 1384, 2, '9'],
        ['UMB', 'Ambala Cantt Junction', '17:50', '17:55', 1584, 2, '2'],
        ['LDH', 'Ludhiana Junction', '19:20', '19:25', 1694, 2, '1'],
        ['ASR', 'Amritsar Junction', '22:15', null, 1833, 2, '1'],
    ]),
];
export const TRAIN_BY_NUMBER = new Map(TRAINS.map((t) => [t.train.number, t]));
//# sourceMappingURL=trains.js.map