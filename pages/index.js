import React from 'react';
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

export default function Home() {
  const [prefectures, setPrefectures] = useState([]);
  const [selectedPrefectures, setSelectedPrefectures] = useState([]);
  const [populationData, setPopulationData] = useState({});
  const [populationType, setPopulationType] = useState("total");
  const [prefectureColors, setPrefectureColors] = useState({});

  useEffect(() => {
    const fetchPrefectures = async () => {
      const response = await fetch(
        "https://opendata.resas-portal.go.jp/api/v1/prefectures",
        {
          headers: {
            "X-API-KEY": process.env.NEXT_PUBLIC_REPAS_API_KEY,
          },
        },
      );
      const data = await response.json();
      setPrefectures(data.result || []);
      assignColors(data.result || []); // Call to assign colors
    };
    fetchPrefectures();
  }, []);

  const assignColors = (prefectures) => {
    const colors = {};
    prefectures.forEach((pref) => {
      colors[pref.prefCode] =
        `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`;
    });
    setPrefectureColors(colors); // Save colors to state
  };

  const handlePrefectureChange = async (prefCode) => {
    if (selectedPrefectures.includes(prefCode)) {
      setSelectedPrefectures(
        selectedPrefectures.filter((code) => code !== prefCode),
      ); // チェックを解除
      setPopulationData((prevData) => {
        const newData = { ...prevData };
        delete newData[prefCode]; // 選択解除した都道府県のデータを削除
        return newData;
      });
    } else {
      setSelectedPrefectures([...selectedPrefectures, prefCode]); // 新たにチェックを追加
      await fetchPopulationData(prefCode);
    }
  };

  const fetchPopulationData = async (prefCode) => {
    try {
      const responseTotal = await fetch(
        `https://opendata.resas-portal.go.jp/api/v1/population/composition/perYear?prefCode=${prefCode}`,
        {
          headers: {
            "X-API-KEY": process.env.NEXT_PUBLIC_REPAS_API_KEY,
          },
        },
      );
      const dataTotal = await responseTotal.json();
      const yearDataTotal = dataTotal?.result?.data;

      if (Array.isArray(yearDataTotal) && yearDataTotal.length > 0) {
        const yearTotal = yearDataTotal[0].data
          .filter((item) => item.year >= 1960) // 1960年以降のデータのみを取得
          .map((item) => ({
            year: item.year,
            total: item.value, // 総人口のデータ
          }));

        const ageGroupData = await fetchAgeGroupData(prefCode);
        const combinedData = yearTotal.map((yearItem) => {
          const ageData =
            ageGroupData.find((age) => age.year === yearItem.year) || {};
          return {
            year: yearItem.year,
            total: yearItem.total,
            youth: ageData.youth || 0,
            working: ageData.working || 0,
            elderly: ageData.elderly || 0,
          };
        });

        setPopulationData((prevData) => ({
          ...prevData,
          [prefCode]: combinedData, // 各都道府県ごとにデータを保存
        }));
      } else {
        setPopulationData((prevData) => ({
          ...prevData,
          [prefCode]: [],
        }));
      }
    } catch (error) {
      console.error("Error fetching population data:", error);
      alert("人口データの取得に失敗しました。");
      setPopulationData((prevData) => ({
        ...prevData,
        [prefCode]: [],
      }));
    }
  };

  const fetchAgeGroupData = async (prefCode) => {
    const yearRange = Array.from(
      { length: (2045 - 1980) / 5 + 1 },
      (_, i) => 1980 + i * 5,
    );
    const ageGroupData = await Promise.all(
      yearRange.map(async (year) => {
        const response = await fetch(
          `https://opendata.resas-portal.go.jp/api/v1/population/composition/pyramid?prefCode=${prefCode}&cityCode=-&yearLeft=${year}&yearRight=${year}`,
          {
            headers: {
              "X-API-KEY": process.env.NEXT_PUBLIC_REPAS_API_KEY,
            },
          },
        );
        const data = await response.json();
        const yearLeftData = data?.result?.yearLeft;
        return yearLeftData
          ? {
              year,
              youth: yearLeftData.newAgeCount || 0,
              working: yearLeftData.middleAgeCount || 0,
              elderly: yearLeftData.oldAgeCount || 0,
            }
          : { year, youth: 0, working: 0, elderly: 0 };
      }),
    );

    return ageGroupData;
  };

  const handlePopulationTypeChange = (event) => {
    setPopulationType(event.target.value);
  };

  const datasets = selectedPrefectures
    .map((prefCode) => {
      const color = prefectureColors[prefCode]; // Use assigned color
      const data = populationData[prefCode] || [];

      return {
        label: `${prefectures.find((pref) => pref.prefCode === prefCode)?.prefName}の${
          populationType === "total"
            ? "総人口"
            : populationType === "youth"
              ? "年少人口"
              : populationType === "working"
                ? "生産年齢人口"
                : "老年人口"
        }`,
        data: data.map((item) => {
          if (populationType === "total") return item.total;
          if (populationType === "youth") return item.youth;
          if (populationType === "working") return item.working;
          return item.elderly;
        }),
        borderColor: color,
        backgroundColor: "rgba(75, 192, 192, 0.2)",
      };
    })
    .filter((dataset) => dataset.data.length > 0); // データがあるもののみを残す

  return (
    <div>
      <h1>都道府県別人口構成</h1>
      <h2>都道府県一覧</h2>
      <div className="prefectures-container">
        <button onClick={() => setSelectedPrefectures([])}>全選択解除</button>{" "}
        {/* 全選択解除ボタン */}
        <ul>
          {prefectures.map((pref) => (
            <li key={pref.prefCode}>
              <label>
                <input
                  type="checkbox"
                  value={pref.prefCode}
                  checked={selectedPrefectures.includes(pref.prefCode)}
                  onChange={() => handlePrefectureChange(pref.prefCode)}
                />
                {pref.prefName}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <h2>人口タイプを選択</h2>
      <div className="population-type-container">
        <div>
          <label className="total">
            <input
              type="radio"
              value="total"
              checked={populationType === "total"}
              onChange={handlePopulationTypeChange}
            />
            総人口
          </label>
          <label className="youth">
            <input
              type="radio"
              value="youth"
              checked={populationType === "youth"}
              onChange={handlePopulationTypeChange}
            />
            年少人口(0歳～14歳)
          </label>
          <label className="working">
            <input
              type="radio"
              value="working"
              checked={populationType === "working"}
              onChange={handlePopulationTypeChange}
            />
            生産年齢人口(15歳～64歳)
          </label>
          <label className="elderly">
            <input
              type="radio"
              value="elderly"
              checked={populationType === "elderly"}
              onChange={handlePopulationTypeChange}
            />
            老年人口(65歳以上)
          </label>
        </div>
      </div>

      <h2>人口構成グラフ</h2>
      <div>
        <div className="graph-container">
          <Line
            data={{
              labels: (populationData[selectedPrefectures[0]] || [])
                .filter(
                  (item) =>
                    (populationType === "total" && item.year >= 1960) || // 総人口の場合は1960年以降
                    (populationType !== "total" && item.year >= 1980), // 他の人口タイプの場合は1980年以降
                )
                .map((item) => item.year),
              datasets:
                datasets.length > 0
                  ? datasets.map((dataset) => ({
                      ...dataset,
                      data: dataset.data.filter(
                        (_, index) =>
                          (populationType === "total" &&
                            (populationData[selectedPrefectures[0]] || [])[
                              index
                            ]?.year >= 1960) ||
                          (populationType !== "total" &&
                            (populationData[selectedPrefectures[0]] || [])[
                              index
                            ]?.year >= 1980),
                      ),
                    }))
                  : [],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: "top",
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
