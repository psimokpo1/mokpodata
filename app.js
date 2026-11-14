// 1. 기상청 부이 및 등표(해수서) 통합 파싱
        if (textBuoy) {
            const lines = textBuoy.split('\n');
            const targetBuoys = [
                { id: '22183', name: '신안',   key: '신안' },
                { id: '22184', name: '추자도', key: '추자도' },
                { id: '22102', name: '칠발도', key: '칠발도' },
                { id: '22298', name: '홍도',   key: '홍도' },
                { id: '22297', name: '가거도', key: '가거도' },
                { id: '22193', name: '흑산도', key: '흑산도' },
                { id: '959',   name: '해수서', key: '해수서파고' }
            ];

            lines.forEach(line => {
                line = line.trim();
                if (!line || line.startsWith('#')) return;
                const cols = line.split(',').map(c => c.trim());
                if (cols.length < 9) return;

                const stnId = cols[2];
                const stnName = cols[3] || '';

                targetBuoys.forEach(tb => {
                    if (stnId === tb.id || (tb.name && stnName.includes(tb.name))) {
                        let rawWh = parseFloat(cols[6]);
                        let rawWd = parseFloat(cols[7]);
                        let rawWs = parseFloat(cols[8]);

                        if (!isNaN(rawWs) && rawWs >= 0 && rawWs < 50.0) {
                            latestBuoyData[tb.key].wind = rawWs.toFixed(1);
                            latestBuoyData[tb.key].windDir = (!isNaN(rawWd) && rawWd >= 0) ? degToDirection(rawWd) : '북서풍';
                            updatedCount++;
                        }
                        if (!isNaN(rawWh) && rawWh >= 0.0 && rawWh <= 12.0) {
                            latestBuoyData[tb.key].sigWave = rawWh.toFixed(1);
                            if (tb.key === '해수서파고' && isNaN(rawWs)) updatedCount++;
                        }
                    }
                });
            });
        }

        // 2. 기상청 AWS (옥도 308)
        if (textAws) {
            const awsLines = textAws.split('\n');
            for (let line of awsLines) {
                line = line.trim();
                if (!line || line.startsWith('#')) continue;
                const cols = line.split(/[\s,]+/).filter(Boolean);
                if (cols.length >= 4 && cols[1] === '308') {
                    const wd1 = parseFloat(cols[2]);
                    const ws1 = parseFloat(cols[3]);
                    const wd10 = cols.length >= 8 ? parseFloat(cols[6]) : -99;
                    const ws10 = cols.length >= 8 ? parseFloat(cols[7]) : -99;

                    const finalWs = (!isNaN(ws10) && ws10 >= 0 && ws10 < 100) ? ws10 : ws1;
                    const finalWd = (!isNaN(wd10) && wd10 >= 0 && wd10 <= 360) ? wd10 : wd1;

                    if (!isNaN(finalWs) && finalWs >= 0 && finalWs < 100) {
                        latestBuoyData['옥도'].wind = finalWs.toFixed(1);
                        latestBuoyData['옥도'].windDir = (!isNaN(finalWd) && finalWd >= 0) ? degToDirection(finalWd) : '북서풍';
                        updatedCount++;
                        break;
                    }
                }
            }
        }
