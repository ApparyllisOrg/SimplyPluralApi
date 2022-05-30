import { Request, Response } from "express";
import moment from "moment";
import { getCollection, parseId } from "../../modules/mongo";
import { getFrontTimeRangeQuery } from "./frontHistory";

interface frontDurationType
{
	value: number,
	num: number,
	min: number,
	max: number
}


interface frontAnalyticValueType
{
	id: String,
	value: number,
}

export const get = async (req: Request, res: Response) => {
	const results : { timings: { morningFronters : frontAnalyticValueType[], dayFronters:frontAnalyticValueType[], eveningFronters:frontAnalyticValueType[], nightFronters: frontAnalyticValueType[] }, values: {sums: frontAnalyticValueType[], averages: frontAnalyticValueType[], maxes: frontAnalyticValueType[], mins: frontAnalyticValueType[], nums: frontAnalyticValueType[]} } = { timings: { morningFronters : [], dayFronters:[], eveningFronters:[], nightFronters:[] }, values: {sums: [], averages: [], maxes: [], mins: [], nums: []} }
	const frontResults = await getCollection("frontHistory").find(getFrontTimeRangeQuery(req, res)).toArray()

	const frontDurationsData : { [key: string]: frontDurationType } = {}

	for (let i = 0; i < frontResults.length; ++i)
	{
		const frontEntry = frontResults[i];
		let value : frontDurationType | undefined = frontDurationsData[frontEntry.member];
		let duration = frontEntry.endTime - frontEntry.startTime
		if (value)
		{
			value.num = value.num + 1;
			value.value = value.value + duration;
			value.min = Math.min(value.min, duration);
			value.min = Math.max(value.max, duration);
		} else {
			const newValue : frontDurationType = {
				value: duration,
				num: 1,
				min: duration,
				max: duration
			}
			frontDurationsData[frontEntry.member] = newValue;
		}
	}


	const keys = Object.keys(frontDurationsData);
	keys.forEach((memberKey) => {
		const average = Math.round(frontDurationsData[memberKey].value / frontDurationsData[memberKey].num);
		results.values.averages.push({id: memberKey, value: average})
		results.values.mins.push({id: memberKey, value: frontDurationsData[memberKey].min})
		results.values.maxes.push({id: memberKey, value: frontDurationsData[memberKey].max})
		results.values.sums.push({id: memberKey, value: frontDurationsData[memberKey].value})
		results.values.nums.push({id: memberKey, value: frontDurationsData[memberKey].num})
	})

	console.log(results)

	res.status(200).send(results);
}