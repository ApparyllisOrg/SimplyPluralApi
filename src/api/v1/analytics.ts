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
	const privateDocument = await getCollection("private").findOne({uid: res.locals.uid})
	const results : { timings: { morningFronters : frontAnalyticValueType[], dayFronters:frontAnalyticValueType[], eveningFronters:frontAnalyticValueType[], nightFronters: frontAnalyticValueType[] }, values: {sums: frontAnalyticValueType[], averages: frontAnalyticValueType[], maxes: frontAnalyticValueType[], mins: frontAnalyticValueType[], nums: frontAnalyticValueType[]} } = { timings: { morningFronters : [], dayFronters:[], eveningFronters:[], nightFronters:[] }, values: {sums: [], averages: [], maxes: [], mins: [], nums: []} }
	const frontResults = await getCollection("frontHistory").find(getFrontTimeRangeQuery(req, res)).toArray()
	const currentFronters = await getCollection("frontHistory").find({uid: res.locals.uid, live: true}).toArray()

	const frontDurationsData : { [key: string]: frontDurationType } = {}

	const allResults = frontResults.concat(currentFronters);

	for (let i = 0; i < allResults.length; ++i)
	{
		const frontEntry = allResults[i];
		let value : frontDurationType | undefined = frontDurationsData[frontEntry.member];
		let duration = (frontEntry.endTime ?? moment.now()) - frontEntry.startTime
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

	const timezone = privateDocument.location

	for (let i = 0; i < allResults.length; ++i)
	{
		const frontEntry = allResults[i];

		const startTime = moment.tz(frontEntry.startTime, timezone)
		const hour = startTime.hour()

		const addFrontInstance = (data: frontAnalyticValueType[], member: string) =>
		{
			const index = data.findIndex((entry: frontAnalyticValueType) => entry.id == member)
			if (index >= 0)
			{
				data[index].value += 1
			}
			else
			{
				data.push({id: member, value: 1})
			}
		}

		if (hour <= 5 || hour >= 22)
		{
			addFrontInstance(results.timings.nightFronters, frontEntry.member)
		}

		if (hour >= 6 && hour < 10)
		{
			addFrontInstance(results.timings.morningFronters, frontEntry.member)
		}

		if (hour >= 11 && hour < 17)
		{
			addFrontInstance(results.timings.dayFronters, frontEntry.member)
		}

		if (hour >= 17 && hour < 22)
		{
			addFrontInstance(results.timings.eveningFronters, frontEntry.member)
		}
	}

	res.status(200).send(results);
}